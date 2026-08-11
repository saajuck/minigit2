import type { CompareResponse, DiffResponse, FileDiffSummary, FileStatus } from "@minigit2/shared";
import { runGit } from "./exec";

const EMPTY_TREE_HASH = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

export async function getCommitFileList(repoPath: string, hash: string): Promise<DiffResponse> {
  const [parentHash, body] = await Promise.all([getFirstParent(repoPath, hash), getCommitBody(repoPath, hash)]);
  const diffBase = parentHash ?? EMPTY_TREE_HASH;
  return { hash, parentHash, body, files: await diffNameStatus(repoPath, diffBase, hash) };
}

/** Everything after the commit message's subject line — git's own definition of "the body",
 * already excluding the subject (CommitNode.subject, from the graph, covers that). Empty for the
 * (common) case of a subject-only message. */
async function getCommitBody(repoPath: string, hash: string): Promise<string> {
  const { stdout } = await runGit(repoPath, ["log", "-1", "--format=%b", hash]);
  return stdout.trimEnd();
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
  const [{ stdout: nameStatusOut }, { stdout: numstatOut }] = await Promise.all([
    runGit(repoPath, ["diff", "--no-color", "--name-status", base, head]),
    runGit(repoPath, ["diff", "--no-color", "-z", "--numstat", base, head]),
  ]);
  const files = parseNameStatus(nameStatusOut);
  const statsByPath = new Map(parseNumstat(numstatOut).map((s) => [s.path, s]));
  return files.map((f) => {
    const stats = statsByPath.get(f.path);
    return { ...f, additions: stats?.additions ?? 0, deletions: stats?.deletions ?? 0 };
  });
}

async function diffFilePatch(repoPath: string, base: string, head: string, filePath: string): Promise<string> {
  const { stdout } = await runGit(repoPath, ["diff", "--no-color", base, head, "--", filePath]);
  return stdout.trimEnd();
}

export interface NameStatusEntry {
  path: string;
  oldPath?: string;
  status: FileStatus;
}

export function parseNameStatus(output: string): NameStatusEntry[] {
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

export interface NumstatEntry {
  path: string;
  additions: number;
  deletions: number;
}

/** Parses `git diff -z --numstat` output. `-z` NUL-delimits records and, critically, splits a
 * rename into three NUL-separated fields (stat header with an empty trailing path, then the old
 * path, then the new path) instead of git's default `old => new` abbreviation — which elides a
 * shared prefix/suffix in a way that isn't safely reversible back into a real path. */
export function parseNumstat(output: string): NumstatEntry[] {
  const tokens = output.split("\0").filter((t) => t !== "");
  const entries: NumstatEntry[] = [];
  let i = 0;
  while (i < tokens.length) {
    const match = /^(\d+|-)\t(\d+|-)\t(.*)$/s.exec(tokens[i]!);
    if (!match) {
      i++;
      continue;
    }
    const additions = match[1] === "-" ? 0 : Number(match[1]);
    const deletions = match[2] === "-" ? 0 : Number(match[2]);
    const inlinePath = match[3]!;
    if (inlinePath.length > 0) {
      entries.push({ path: inlinePath, additions, deletions });
      i += 1;
    } else {
      const newPath = tokens[i + 2];
      if (newPath !== undefined) entries.push({ path: newPath, additions, deletions });
      i += 3;
    }
  }
  return entries;
}
