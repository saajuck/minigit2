import { Router } from "express";
import { getRepoStatus } from "../git/status";
import { resolveRepo } from "../middleware/resolveRepo";
import { respondGitError } from "./errorResponse";

export const statusRouter = Router({ mergeParams: true });

statusRouter.get("/", resolveRepo, async (req, res) => {
  try {
    const status = await getRepoStatus(req.repo!.path);
    res.json(status);
  } catch (err) {
    respondGitError(res, err);
  }
});
