import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";

/** A throwaway two-commit, two-branch repo — created fresh per test run rather than relying on
 * any repo already registered in the app (which varies by environment), so this test is
 * self-contained and portable to CI. */
function makeTestRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "minigit2-e2e-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "e2e@example.com");
  git("config", "user.name", "e2e");
  writeFileSync(path.join(dir, "a.txt"), "hello\n");
  git("add", "a.txt");
  git("commit", "-q", "-m", "initial commit");
  git("checkout", "-q", "-b", "feature");
  writeFileSync(path.join(dir, "b.txt"), "feature work\n");
  git("add", "b.txt");
  git("commit", "-q", "-m", "add feature file");
  git("checkout", "-q", "main");
  return dir;
}

/** Same throwaway repo with an annotated tag on the first commit. Kept separate from
 * makeTestRepo rather than folded into it: the extra ref badge takes real width in a commit row,
 * which squeezes the subject column to nothing at the default viewport — the other tests assert
 * on that subject text, so they'd start failing for a reason that has nothing to do with them. */
function makeTaggedRepo(): string {
  const dir = makeTestRepo();
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir });
  git("tag", "-a", "v1.0.0", "-m", "first release", "main");
  return dir;
}

test("add a repo, view a commit's diff, and check out a branch", async ({ page }) => {
  const repoDir = makeTestRepo();
  try {
    await page.goto("/");

    await page.getByRole("button", { name: "Add repository" }).click();
    await page.getByPlaceholder("/home/alice/code/my-project").fill(repoDir);
    await page.getByRole("button", { name: "Add repository" }).last().click();

    // The commit graph loads once the repo's added; "initial commit" is the root, always present.
    const commitRow = page.getByText("initial commit", { exact: true });
    await expect(commitRow).toBeVisible({ timeout: 10_000 });
    await commitRow.click();

    // Selecting a commit shows its diff — a.txt is the one file that commit touched. Appears
    // twice (stats summary + file list row), so just check at least one is visible.
    await expect(page.getByText("a.txt").first()).toBeVisible();

    // Double-clicking the feature commit checks it out — the status chip should pick up the
    // new branch name once the checkout completes.
    const featureCommitRow = page.getByText("add feature file", { exact: true });
    await featureCommitRow.dblclick();
    await expect(page.getByText("feature", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

/** Regression guard for the diff panel stacking stale blocks: its per-commit sections are keyed
 * by commit hash, and when two siblings carried the *same* key, switching commits faster than a
 * render settles left the previous commit's block mounted above the new one — up to four stacked,
 * pushing the actual diff off screen. Clicking with no wait in between is what surfaced it; a
 * paced click never did. Asserted on the file list, the keyed section that outlived the churn
 * table it used to sit under. */
test("switching commits quickly does not stack diff sections", async ({ page }) => {
  const repoDir = makeTestRepo();
  try {
    await page.goto("/");

    await page.getByRole("button", { name: "Add repository" }).click();
    await page.getByPlaceholder("/home/alice/code/my-project").fill(repoDir);
    await page.getByRole("button", { name: "Add repository" }).last().click();

    const first = page.getByText("initial commit", { exact: true });
    await expect(first).toBeVisible({ timeout: 10_000 });
    const second = page.getByText("add feature file", { exact: true });

    for (let i = 0; i < 8; i++) {
      await (i % 2 === 0 ? second : first).click({ delay: 0 });
    }
    // Let every in-flight diff request settle, so a late arrival can't add a section after the
    // assertion rather than before it.
    await page.waitForTimeout(1500);

    await expect(page.getByRole("button", { name: /file(s)? changed/i })).toHaveCount(1);
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test("the Tags dialog lists tags and selects the commit one points at", async ({ page }) => {
  const repoDir = makeTaggedRepo();
  try {
    await page.goto("/");

    await page.getByRole("button", { name: "Add repository" }).click();
    await page.getByPlaceholder("/home/alice/code/my-project").fill(repoDir);
    await page.getByRole("button", { name: "Add repository" }).last().click();

    // Assertions go through the rows and their ref badges rather than the subject text: with a
    // tag badge in play the subject column can be squeezed to zero width at this viewport.
    const rows = page.locator(".commit-row");
    await expect(rows).toHaveCount(2, { timeout: 10_000 });

    // Select the *other* commit first, so "went to the tag's commit" can't pass by accident.
    await rows.filter({ hasText: "add feature file" }).click();
    await expect(page.locator(".commit-row.selected")).toContainText("add feature file");

    await page.getByRole("button", { name: "Tags", exact: true }).click();
    const dialog = page.locator(".dialog");
    await expect(dialog).toContainText("v1.0.0");
    // The annotated tag's own message, not the commit's — the two differ here on purpose.
    await expect(dialog).toContainText("first release");

    await dialog.getByRole("button", { name: /Go to v1.0.0/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator(".commit-row.selected")).toContainText("v1.0.0");
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});
