import { Router } from "express";
import { getReflog } from "../git/reflog";
import { resolveRepo } from "../middleware/resolveRepo";

export const reflogRouter = Router({ mergeParams: true });

reflogRouter.get("/", resolveRepo, async (req, res) => {
  try {
    const entries = await getReflog(req.repo!.path);
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: "git_error", message: (err as Error).message });
  }
});
