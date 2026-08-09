import type { FileDiffSummary, FileStatus } from "@minigit2/shared";
import { parseNameStatus } from "./diff";
import { runGit } from "./exec";

const EMPTY_TREE_HASH = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

/** Uncommitted changes: working tree + index, against HEAD (or the empty tree on an unborn branch). */
export async function getLocalDiffFileList(repoPath: string): Promise<FileDiffSummary[]> {
  const base = await resolveDiffBase(repoPath);
  const { stdout } = await runGit(repoPath, ["diff", "--no-color", "--name-status", base]);
  const tracked = parseNameStatus(stdout);
  const untracked = await getUntrackedFiles(repoPath);
  return [...tracked, ...untracked];
}

/** Untracked files have no blob to diff against HEAD, so they're synthesized via `diff --no-index` against /dev/null. */
export async function getLocalDiffFilePatch(repoPath: string, filePath: string): Promise<string> {
  if (await isFileUntracked(repoPath, filePath)) {
    const { stdout } = await runGit(
      repoPath,
      ["diff", "--no-color", "--no-index", "--", "/dev/null", filePath],
      { allowExitCodes: [1] },
    );
    return stdout.trimEnd();
  }
  const base = await resolveDiffBase(repoPath);
  const { stdout } = await runGit(repoPath, ["diff", "--no-color", base, "--", filePath]);
  return stdout.trimEnd();
}

async function resolveDiffBase(repoPath: string): Promise<string> {
  try {
    await runGit(repoPath, ["rev-parse", "--verify", "HEAD"]);
    return "HEAD";
  } catch {
    return EMPTY_TREE_HASH;
  }
}

async function getUntrackedFiles(repoPath: string): Promise<FileDiffSummary[]> {
  const { stdout } = await runGit(repoPath, ["ls-files", "--others", "--exclude-standard"]);
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((path) => ({ path, status: "untracked" as FileStatus }));
}

async function isFileUntracked(repoPath: string, filePath: string): Promise<boolean> {
  const { stdout } = await runGit(repoPath, ["status", "--porcelain=v1", "--", filePath]);
  return stdout.trimStart().startsWith("??");
}
