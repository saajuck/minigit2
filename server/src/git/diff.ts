import type { CompareResponse, DiffResponse, FileDiffSummary, FileStatus } from "@minigit2/shared";
import { runGit } from "./exec";

const EMPTY_TREE_HASH = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

export async function getCommitFileList(repoPath: string, hash: string): Promise<DiffResponse> {
  const parentHash = await getFirstParent(repoPath, hash);
  const diffBase = parentHash ?? EMPTY_TREE_HASH;
  return { hash, parentHash, files: await diffNameStatus(repoPath, diffBase, hash) };
}

/** Fetches a single file's patch on demand — the file list endpoint stays cheap even for large diffs. */
export async function getCommitFilePatch(repoPath: string, hash: string, filePath: string): Promise<string> {
  const parentHash = await getFirstParent(repoPath, hash);
  const diffBase = parentHash ?? EMPTY_TREE_HASH;
  return diffFilePatch(repoPath, diffBase, hash, filePath);
}

/** Diff between two arbitrary refs (not necessarily parent/child) — same shape as a commit diff. */
export async function getCompareFileList(repoPath: string, from: string, to: string): Promise<CompareResponse> {
  return { from, to, files: await diffNameStatus(repoPath, from, to) };
}

export async function getCompareFilePatch(
  repoPath: string,
  from: string,
  to: string,
  filePath: string,
): Promise<string> {
  return diffFilePatch(repoPath, from, to, filePath);
}

/** Merge commits are diffed against their first parent only (mainline convention). */
async function getFirstParent(repoPath: string, hash: string): Promise<string | null> {
  const { stdout } = await runGit(repoPath, ["rev-list", "--parents", "-n", "1", hash]);
  const parts = stdout.trim().split(" ");
  return parts[1] ?? null;
}

async function diffNameStatus(repoPath: string, base: string, head: string): Promise<FileDiffSummary[]> {
  const { stdout } = await runGit(repoPath, ["diff", "--no-color", "--name-status", base, head]);
  return parseNameStatus(stdout);
}

async function diffFilePatch(repoPath: string, base: string, head: string, filePath: string): Promise<string> {
  const { stdout } = await runGit(repoPath, ["diff", "--no-color", base, head, "--", filePath]);
  return stdout.trimEnd();
}

export function parseNameStatus(output: string): FileDiffSummary[] {
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
