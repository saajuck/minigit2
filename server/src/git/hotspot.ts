import type { FileHotspot, FilesHotspotResponse } from "@minigit2/shared";
import { getCommitChangedPaths } from "./diff";
import { runGit } from "./exec";

// A byte that can't appear in a commit's author email — used to delimit commits in the combined
// log below so a single walk can be split back into per-commit chunks.
const COMMIT_DELIMITER = "\x01";

/** Whole-history commit/author count for every file `hash` touched, in one pass over the log —
 * "how hot is this file overall", independent of the commit it's viewed alongside. `--all`
 * rather than bare HEAD: the rest of the app (the graph itself) is built from `--all` too, and a
 * plain `git log` would silently undercount on a repo where the checked-out branch's HEAD
 * doesn't descend from most of a file's real history (e.g. an orphan/squashed tip, or simply a
 * branch other than the one that file's history mostly lives on). Deliberately not
 * `--follow`-ed across renames (same simplification as blame) — a rename is treated as a new
 * file starting fresh, matching what `git log -- <path>` alone would show.
 *
 * Takes just the commit hash, not a path list from the caller — the touched files are derived
 * here (cheap: one `git diff --name-only`, the same lookup `/diff` already does) rather than
 * having the client fetch them once and hand them straight back, which for a commit touching
 * thousands of files meant shipping megabytes of paths across the wire for no reason (previously
 * a request body; before that, a query string long enough to trip a 431).
 *
 * One `git log --all --name-only` walk of the whole history covers every touched path at once,
 * rather than one `git log -- <path>` walk per path — for a commit touching hundreds of files (a
 * lockfile bump, a generated-code refresh, a big rename sweep) that's the difference between one
 * process and hundreds fired in parallel. */
export async function getFilesHotspot(repoPath: string, hash: string): Promise<FilesHotspotResponse> {
  const [paths, { stdout }] = await Promise.all([
    getCommitChangedPaths(repoPath, hash),
    // `-z`: leaves paths unquoted (see getCommitChangedPaths) so they match `wanted` below.
    runGit(repoPath, ["log", "--all", "-z", "--name-only", `--format=${COMMIT_DELIMITER}%ae`]),
  ]);
  return parseHotspotLog(stdout, new Set(paths));
}

export function parseHotspotLog(output: string, wanted: Set<string>): FilesHotspotResponse {
  const counts = new Map<string, { commits: number; authors: Set<string> }>();
  // The first split segment is whatever precedes the very first delimiter (empty for real git
  // output) — drop it rather than trying to parse it as a commit.
  for (const chunk of output.split(COMMIT_DELIMITER).slice(1)) {
    const emailEnd = chunk.indexOf("\0");
    if (emailEnd === -1) continue;
    const email = chunk.slice(0, emailEnd);
    // With `-z`, git NUL-terminates the format text, then keeps its own trailing "\n" before the
    // (also NUL-terminated) list of touched paths. A merge commit has nothing to list and no
    // trailing "\n" at all — `lineBreak === -1` then correctly yields zero paths for it.
    const lineBreak = chunk.indexOf("\n", emailEnd);
    const pathsPart = lineBreak === -1 ? "" : chunk.slice(lineBreak + 1);
    for (const path of pathsPart.split("\0")) {
      if (!path || !wanted.has(path)) continue;
      let entry = counts.get(path);
      if (!entry) {
        entry = { commits: 0, authors: new Set() };
        counts.set(path, entry);
      }
      entry.commits++;
      entry.authors.add(email);
    }
  }
  const result: FilesHotspotResponse = {};
  for (const path of wanted) {
    const entry = counts.get(path);
    result[path] = entry ? { commits: entry.commits, authors: entry.authors.size } : emptyHotspot();
  }
  return result;
}

function emptyHotspot(): FileHotspot {
  return { commits: 0, authors: 0 };
}
