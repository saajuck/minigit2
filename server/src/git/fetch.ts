import { runGit } from "./exec";

const FETCH_TIMEOUT_MS = 15_000;

/**
 * Updates remote-tracking branches (origin/*) before the caller re-reads local state. Best-effort:
 * offline, no remote configured, or an auth prompt that would otherwise hang are all just failures
 * for the caller to swallow — the graph degrades to today's local-only view, nothing breaks.
 * `GIT_TERMINAL_PROMPT=0` makes a missing credential fail fast instead of hanging until the timeout.
 */
export async function fetchAll(repoPath: string): Promise<void> {
  await runGit(repoPath, ["fetch", "--all", "--prune"], {
    timeoutMs: FETCH_TIMEOUT_MS,
    env: { GIT_TERMINAL_PROMPT: "0" },
  });
}
