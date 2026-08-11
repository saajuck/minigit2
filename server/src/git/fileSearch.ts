import { runGit } from "./exec";

/** Hashes of every commit (across all refs) that touched `pathspec` — git's own pathspec
 * matching, so an exact file matches just that file and a directory matches everything under
 * it, with no glob syntax needed on our end. */
export async function searchCommitsByPath(repoPath: string, pathspec: string): Promise<string[]> {
  const { stdout } = await runGit(repoPath, ["log", "--all", "--format=%H", "--", pathspec]);
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
