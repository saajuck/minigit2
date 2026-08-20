import type { Response } from "express";
import { isMissingObjectError } from "../git/errorClassification";

/**
 * Shared shape for "a git command failed" across routes — was previously copy-pasted (identically
 * in diff.ts and compare.ts, and equivalent minus the 404 branch in status/branches/stash/reflog/
 * localDiff/search) rather than shared. A missing object (rebase/amend/prune since the client's
 * data was loaded) becomes a 404 `commit_not_found` when the caller passes a message for it;
 * everything else is a flat 500 `git_error`. Callers with no commit-hash-lookup failure mode
 * (status, branches, stash, reflog, search, local diff) just omit `notFoundMessage` and always
 * get the 500 branch, same as before.
 *
 * Not used by fetch.ts's `fetch_error` or diff.ts's `hotspot_error` — those intentionally use
 * their own error code so the client's SILENT_CODES list (client/src/api/client.ts) can suppress
 * a toast for routine, non-user-triggered failures, unlike `git_error` which always toasts.
 */
export function respondGitError(res: Response, err: unknown, notFoundMessage?: string): void {
  if (notFoundMessage !== undefined && isMissingObjectError(err)) {
    res.status(404).json({ error: "commit_not_found", message: notFoundMessage });
    return;
  }
  res.status(500).json({ error: "git_error", message: (err as Error).message });
}
