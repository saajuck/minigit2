import type { FileHotspot } from "@minigit2/shared";
import { runGit } from "./exec";

/** Whole-history commit/author count for a single file, independent of the commit it's viewed
 * alongside — "how hot is this file overall". `--all` rather than bare HEAD: the rest of the app
 * (the graph itself) is built from `--all` too, and a plain `git log` would silently undercount
 * on a repo where the checked-out branch's HEAD doesn't descend from most of the file's real
 * history (e.g. an orphan/squashed tip, or simply a branch other than the one this file's history
 * mostly lives on). Deliberately not `--follow`-ed across renames (same simplification as blame),
 * and scoped to one path at a time since git can't report separate per-path counts from a single
 * multi-path `log` call. */
export async function getFileHotspot(repoPath: string, filePath: string): Promise<FileHotspot> {
  const { stdout } = await runGit(repoPath, ["log", "--all", "--format=%ae", "--", filePath]);
  return parseHotspotLog(stdout);
}

export function parseHotspotLog(output: string): FileHotspot {
  const emails = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return { commits: emails.length, authors: new Set(emails).size };
}
