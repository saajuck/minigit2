import { Router } from "express";
import { getTags } from "../git/tags";
import { resolveRepo } from "../middleware/resolveRepo";
import { respondGitError } from "./errorResponse";

export const tagsRouter = Router({ mergeParams: true });

tagsRouter.get("/", resolveRepo, async (req, res) => {
  try {
    res.json(await getTags(req.repo!.path));
  } catch (err) {
    respondGitError(res, err);
  }
});
