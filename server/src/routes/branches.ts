import { Router } from "express";
import { getBranches } from "../git/branches";
import { resolveRepo } from "../middleware/resolveRepo";
import { respondGitError } from "./errorResponse";

export const branchesRouter = Router({ mergeParams: true });

branchesRouter.get("/", resolveRepo, async (req, res) => {
  try {
    const branches = await getBranches(req.repo!.path);
    res.json(branches);
  } catch (err) {
    respondGitError(res, err);
  }
});
