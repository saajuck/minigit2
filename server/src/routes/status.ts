import { Router } from "express";
import { getRepoStatus } from "../git/status";
import { resolveRepo } from "../middleware/resolveRepo";

export const statusRouter = Router({ mergeParams: true });

statusRouter.get("/", resolveRepo, async (req, res) => {
  try {
    const status = await getRepoStatus(req.repo!.path);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: "git_error", message: (err as Error).message });
  }
});
