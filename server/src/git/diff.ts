import type { DiffResponse, FileDiffSummary, FileStatus } from "@minigit2/shared";
import { runGit } from "./exec";

const EMPTY_TREE_HASH = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

export async function getCommitFileList(repoPath: string, hash: string): Promise<DiffResponse> {
  const parentHash = await getFirstParent(repoPath, hash);
  const diffBase = parentHash ?? EMPTY_TREE_HASH;
  const { stdout } = await runGit(repoPath, ["diff", "--no-color", "--name-status", diffBase, hash]);
  return { hash, parentHash, files: parseNameStatus(stdout) };
}

/** Fetches a single file's patch on demand — the file list endpoint stays cheap even for large diffs. */
export async function getCommitFilePatch(repoPath: string, hash: string, filePath: string): Promise<string> {
  const parentHash = await getFirstParent(repoPath, hash);
  const diffBase = parentHash ?? EMPTY_TREE_HASH;
  const { stdout } = await runGit(repoPath, ["diff", "--no-color", diffBase, hash, "--", filePath]);
  return stdout.trimEnd();
}

/** Merge commits are diffed against their first parent only (mainline convention). */
async function getFirstParent(repoPath: string, hash: string): Promise<string | null> {
  const { stdout } = await runGit(repoPath, ["rev-list", "--parents", "-n", "1", hash]);
  const parts = stdout.trim().split(" ");
  return parts[1] ?? null;
}

function parseNameStatus(output: string): FileDiffSummary[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      const code = parts[0] ?? "";
      if (code.startsWith("R")) {
        const oldPath = parts[1];
        const newPath = parts[2] ?? oldPath ?? "";
        return { path: newPath, oldPath, status: "renamed" as FileStatus };
      }
      const path = parts[1] ?? "";
      if (code.startsWith("A")) return { path, status: "added" as FileStatus };
      if (code.startsWith("D")) return { path, status: "deleted" as FileStatus };
      return { path, status: "modified" as FileStatus };
    });
}
