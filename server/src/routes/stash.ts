import { Router } from "express";
import { getStashList } from "../git/stash";
import { resolveRepo } from "../middleware/resolveRepo";

export const stashRouter = Router({ mergeParams: true });

stashRouter.get("/", resolveRepo, async (req, res) => {
  try {
    const entries = await getStashList(req.repo!.path);
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: "git_error", message: (err as Error).message });
  }
});
