import type { DiffResponse, FileDiff, FileStatus } from "@minigit2/shared";
import { runGit } from "./exec";

const EMPTY_TREE_HASH = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

export async function getCommitDiff(repoPath: string, hash: string): Promise<DiffResponse> {
  const parentHash = await getFirstParent(repoPath, hash);
  const diffBase = parentHash ?? EMPTY_TREE_HASH;
  const { stdout } = await runGit(repoPath, ["diff", "--no-color", diffBase, hash]);
  return { hash, parentHash, files: parseUnifiedDiff(stdout) };
}

/** Merge commits are diffed against their first parent only (mainline convention). */
async function getFirstParent(repoPath: string, hash: string): Promise<string | null> {
  const { stdout } = await runGit(repoPath, ["rev-list", "--parents", "-n", "1", hash]);
  const parts = stdout.trim().split(" ");
  return parts[1] ?? null;
}

function parseUnifiedDiff(diffText: string): FileDiff[] {
  if (!diffText.trim()) return [];
  return diffText
    .split(/^(?=diff --git )/m)
    .filter((section) => section.trim().length > 0)
    .map(parseFileSection);
}

function parseFileSection(section: string): FileDiff {
  const headerMatch = section.match(/^diff --git a\/(.+?) b\/(.+)$/m);
  const bPath = headerMatch?.[2] ?? "unknown";
  const aPath = headerMatch?.[1] ?? bPath;

  let status: FileStatus = "modified";
  let oldPath: string | undefined;

  if (/^new file mode/m.test(section)) {
    status = "added";
  } else if (/^deleted file mode/m.test(section)) {
    status = "deleted";
  } else if (/^rename from /m.test(section)) {
    status = "renamed";
    oldPath = aPath;
  }

  return {
    path: bPath,
    ...(oldPath ? { oldPath } : {}),
    status,
    patch: section.trimEnd(),
  };
}
