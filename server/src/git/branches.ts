import type { BranchesResponse, BranchInfo } from "@minigit2/shared";
import { runGit } from "./exec";

const SEP = "\x1f";

export async function getBranches(repoPath: string): Promise<BranchesResponse> {
  const [local, remote, defaultBranch] = await Promise.all([
    getLocalBranches(repoPath),
    getRemoteBranches(repoPath),
    resolveDefaultBranch(repoPath),
  ]);
  return { local, remote, defaultBranch };
}

async function getLocalBranches(repoPath: string): Promise<BranchInfo[]> {
  const { stdout } = await runGit(repoPath, [
    "for-each-ref",
    "refs/heads",
    `--format=%(refname)${SEP}%(refname:short)${SEP}%(objectname)${SEP}%(HEAD)`,
  ]);
  return parseRefs(stdout, true).map(({ name, hash, isHead }) => ({ name, hash, isHead }));
}

async function getRemoteBranches(repoPath: string): Promise<BranchInfo[]> {
  const { stdout } = await runGit(repoPath, [
    "for-each-ref",
    "refs/remotes",
    `--format=%(refname)${SEP}%(refname:short)${SEP}%(objectname)${SEP}%(HEAD)`,
  ]);
  // refs/remotes/<remote>/HEAD is a symbolic pointer (not a real branch); its refname:short
  // collapses to just "<remote>", so filtering on the full refname is required to catch it.
  return parseRefs(stdout, false)
    .filter((b) => !b.fullRefname.endsWith("/HEAD"))
    .map(({ name, hash, isHead }) => ({ name, hash, isHead }));
}

function parseRefs(stdout: string, markHead: boolean): (BranchInfo & { fullRefname: string })[] {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [fullRefname, name, hash, headMarker] = line.split(SEP) as [string, string, string, string];
      return { fullRefname, name, hash, isHead: markHead && headMarker === "*" };
    });
}

/** Prefers the locally-recorded origin/HEAD symlink (offline, set on clone); falls back to a
 * best-effort guess among common default branch names if it was never set. */
async function resolveDefaultBranch(repoPath: string): Promise<string | null> {
  try {
    const { stdout } = await runGit(repoPath, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
    const ref = stdout.trim();
    const shortName = ref.split("/").slice(1).join("/");
    return shortName || null;
  } catch {
    for (const candidate of ["main", "master"]) {
      try {
        await runGit(repoPath, ["rev-parse", "--verify", "--quiet", `refs/heads/${candidate}`]);
        return candidate;
      } catch {
        continue;
      }
    }
    return null;
  }
}
