import { Router } from "express";
import { getCommitLog } from "../git/log";
import { layoutGraph } from "../graph/layout";
import { resolveRepo } from "../middleware/resolveRepo";

export const graphRouter = Router({ mergeParams: true });

graphRouter.get("/", resolveRepo, async (req, res) => {
  try {
    const commits = await getCommitLog(req.repo!.path);
    const { nodes, edges } = layoutGraph(commits);
    res.json({ nodes, edges });
  } catch (err) {
    res.status(500).json({ error: "git_error", message: (err as Error).message });
  }
});
