import type { StatusResponse } from "@minigit2/shared";
import { runGit } from "./exec";

export async function getRepoStatus(repoPath: string): Promise<StatusResponse> {
  const branch = await getCurrentBranch(repoPath);
  const headCommit = await getHeadCommit(repoPath);
  const { staged, unstaged, untracked } = await getWorkingTreeCounts(repoPath);
  const aheadBehind = branch.detached ? null : await getAheadBehind(repoPath);

  return {
    headCommit,
    branch: branch.name,
    detached: branch.detached,
    dirty: staged + unstaged + untracked > 0,
    staged,
    unstaged,
    untracked,
    aheadBehind,
  };
}

/** Null when there's no upstream configured (e.g. a local-only branch) — not an error. */
async function getAheadBehind(repoPath: string): Promise<{ ahead: number; behind: number } | null> {
  try {
    const { stdout } = await runGit(repoPath, ["rev-list", "--left-right", "--count", "@{upstream}...HEAD"]);
    const [behindRaw, aheadRaw] = stdout.trim().split(/\s+/);
    const behind = Number(behindRaw);
    const ahead = Number(aheadRaw);
    if (Number.isNaN(ahead) || Number.isNaN(behind)) return null;
    return { ahead, behind };
  } catch {
    return null;
  }
}

async function getCurrentBranch(repoPath: string): Promise<{ name: string | null; detached: boolean }> {
  try {
    const { stdout } = await runGit(repoPath, ["symbolic-ref", "--short", "-q", "HEAD"]);
    const name = stdout.trim();
    return { name: name || null, detached: false };
  } catch {
    return { name: null, detached: true };
  }
}

async function getHeadCommit(repoPath: string): Promise<string | null> {
  try {
    const { stdout } = await runGit(repoPath, ["rev-parse", "HEAD"]);
    return stdout.trim();
  } catch {
    return null; // unborn branch, no commits yet
  }
}

async function getWorkingTreeCounts(
  repoPath: string,
): Promise<{ staged: number; unstaged: number; untracked: number }> {
  const { stdout } = await runGit(repoPath, ["status", "--porcelain=v1"]);
  const lines = stdout.split("\n").filter((line) => line.length > 0);

  let staged = 0;
  let unstaged = 0;
  let untracked = 0;

  for (const line of lines) {
    const indexStatus = line[0];
    const worktreeStatus = line[1];
    if (indexStatus === "?" && worktreeStatus === "?") {
      untracked++;
      continue;
    }
    if (indexStatus !== " " && indexStatus !== "?") staged++;
    if (worktreeStatus !== " " && worktreeStatus !== "?") unstaged++;
  }

  return { staged, unstaged, untracked };
}
