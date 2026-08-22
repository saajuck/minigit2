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

/** Just the list of paths a commit touched, no status/stats — cheaper than getCommitFileList's
 * full name-status + numstat, for callers (hotspot) that only need "which files". */
export async function getCommitChangedPaths(repoPath: string, hash: string): Promise<string[]> {
  const parentHash = await getFirstParent(repoPath, hash);
  const diffBase = parentHash ?? EMPTY_TREE_HASH;
  // `-z`: without it, git C-quotes any path with non-ASCII bytes/quotes/backslashes (e.g.
  // `café.txt` -> `"caf\303\251.txt"`), which would silently break the `wanted`-set lookup in
  // hotspot.ts against paths sourced from the (also `-z`'d) name-status/log walks below.
  const { stdout } = await runGit(repoPath, ["diff", "--no-color", "-z", "--name-only", diffBase, hash]);
  return stdout.split("\0").filter((path) => path !== "");
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
  // Both calls need `-z`: without it, `--name-status` C-quotes non-ASCII/quote/backslash paths
  // (e.g. `café.txt` -> `"caf\303\251.txt"`) while `--numstat` here doesn't, so a join keyed by
  // path would silently miss for exactly those files.
  const [{ stdout: nameStatusOut }, { stdout: numstatOut }] = await Promise.all([
    runGit(repoPath, ["diff", "--no-color", "-z", "--name-status", base, head]),
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

/** Parses `git diff -z --name-status` output. `-z` NUL-delimits records (status code, then
 * either one inline path or, for a rename, old path then new path as two separate fields) and,
 * critically, leaves paths unquoted — without it git C-quotes non-ASCII/quote/backslash paths. */
export function parseNameStatus(output: string): NameStatusEntry[] {
  const tokens = output.split("\0").filter((t) => t !== "");
  const entries: NameStatusEntry[] = [];
  let i = 0;
  while (i < tokens.length) {
    const code = tokens[i]!;
    if (code.startsWith("R")) {
      const oldPath = tokens[i + 1];
      const newPath = tokens[i + 2];
      if (oldPath !== undefined && newPath !== undefined) {
        entries.push({ path: newPath, oldPath, status: "renamed" as FileStatus });
      }
      i += 3;
      continue;
    }
    const path = tokens[i + 1];
    if (path !== undefined) {
      const status: FileStatus = code.startsWith("A") ? "added" : code.startsWith("D") ? "deleted" : "modified";
      entries.push({ path, status });
    }
    i += 2;
  }
  return entries;
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
