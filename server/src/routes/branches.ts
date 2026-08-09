import { Router } from "express";
import { getBranches } from "../git/branches";
import { resolveRepo } from "../middleware/resolveRepo";

export const branchesRouter = Router({ mergeParams: true });

branchesRouter.get("/", resolveRepo, async (req, res) => {
  try {
    const branches = await getBranches(req.repo!.path);
    res.json(branches);
  } catch (err) {
    res.status(500).json({ error: "git_error", message: (err as Error).message });
  }
});
