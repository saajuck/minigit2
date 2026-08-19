import type { NextFunction, Request, Response } from "express";
import { isUnsafeRef } from "../git/exec";

const INVALID_REF_RESPONSE = {
  error: "invalid_ref",
  message: "Invalid commit reference.",
};

/** Rejects a `:hash` route param that starts with "-" before it can reach a git command as a
 * bare positional argument, where it would be read as a command-line option instead of a
 * revision (e.g. `--output=/etc/passwd`) — see isUnsafeRef in git/exec.ts for the full
 * rationale.
 *
 * Registered via `router.param("hash", ...)`, NOT `router.use(...)` — a path-less `router.use()`
 * runs in registration order as soon as a request reaches the router, which is *before* Express
 * has matched a specific route pattern like `/:hash/diff` and populated `req.params.hash`. A
 * `.use()`-based version of this check silently no-ops (req.params.hash is always undefined at
 * that point) and lets every request through unchecked — verified live against a running server
 * before switching to `router.param`, which Express guarantees runs once the param is actually
 * captured, before the route handler. */
export function validateHashParam(req: Request, res: Response, next: NextFunction, hash: string): void {
  if (isUnsafeRef(hash)) {
    res.status(400).json(INVALID_REF_RESPONSE);
    return;
  }
  next();
}
