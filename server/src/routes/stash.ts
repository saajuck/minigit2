import { Router } from "express";
import { getStashList } from "../git/stash";
import { resolveRepo } from "../middleware/resolveRepo";
import { respondGitError } from "./errorResponse";

export const stashRouter = Router({ mergeParams: true });

stashRouter.get("/", resolveRepo, async (req, res) => {
  try {
    const entries = await getStashList(req.repo!.path);
    res.json({ entries });
  } catch (err) {
    respondGitError(res, err);
  }
});
