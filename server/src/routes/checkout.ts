import { Router } from "express";
import { CheckoutConflictError, checkoutRef } from "../git/checkout";
import { isUnsafeRef } from "../git/exec";
import { getRepoStatus } from "../git/status";
import { resolveRepo } from "../middleware/resolveRepo";
import { respondGitError } from "./errorResponse";

export const checkoutRouter = Router({ mergeParams: true });

checkoutRouter.post("/", resolveRepo, async (req, res) => {
  const ref = req.body?.ref;
  if (typeof ref !== "string" || ref.trim() === "") {
    res.status(400).json({ error: "invalid_ref", message: "ref is required" });
    return;
  }
  if (isUnsafeRef(ref)) {
    res.status(400).json({ error: "invalid_ref", message: "Invalid ref." });
    return;
  }

  try {
    await checkoutRef(req.repo!.path, ref);
    const status = await getRepoStatus(req.repo!.path);
    res.json({ ok: true, status });
  } catch (err) {
    if (err instanceof CheckoutConflictError) {
      res.status(409).json({ error: "dirty_worktree", message: err.stderr || err.message });
      return;
    }
    respondGitError(res, err);
  }
});
