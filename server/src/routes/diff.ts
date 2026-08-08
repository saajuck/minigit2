import { Router } from "express";
import { getCommitDiff } from "../git/diff";
import { resolveRepo } from "../middleware/resolveRepo";

export const diffRouter = Router({ mergeParams: true });

diffRouter.get("/:hash/diff", resolveRepo, async (req, res) => {
  try {
    const diff = await getCommitDiff(req.repo!.path, req.params.hash as string);
    res.json(diff);
  } catch (err) {
    res.status(500).json({ error: "git_error", message: (err as Error).message });
  }
});
