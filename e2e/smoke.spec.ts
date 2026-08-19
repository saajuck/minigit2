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
