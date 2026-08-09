import { GitError } from "./exec";

const MISSING_OBJECT_RE = /bad object|bad revision|unknown revision or path not in the working tree/i;

/**
 * True when a git command failed because a ref/commit no longer exists in the repo — e.g. the
 * client's commit list is stale and the underlying history was rewritten (rebase/amend/force-push)
 * or pruned (the app runs `git fetch --all --prune` on every auto-refresh) since it was loaded.
 * Distinguishing this from a genuine git failure lets routes answer 404 instead of 500.
 */
export function isMissingObjectError(err: unknown): boolean {
  return err instanceof GitError && MISSING_OBJECT_RE.test(err.stderr);
}
