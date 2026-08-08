import type { StatusResponse } from "@minigit2/shared";
import { runGit } from "./exec";

export async function getRepoStatus(repoPath: string): Promise<StatusResponse> {
  const branch = await getCurrentBranch(repoPath);
  const headCommit = await getHeadCommit(repoPath);
  const { staged, unstaged, untracked } = await getWorkingTreeCounts(repoPath);

  return {
    headCommit,
    branch: branch.name,
    detached: branch.detached,
    dirty: staged + unstaged + untracked > 0,
    staged,
    unstaged,
    untracked,
  };
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
