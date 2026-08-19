import { Router } from "express";
import { getCommitLog } from "../git/log";
import { getRefTipsSignature } from "../git/refTips";
import { getCachedGraph, setCachedGraph } from "../graph/graphCache";
import { layoutGraph } from "../graph/layout";
import { resolveRepo } from "../middleware/resolveRepo";

export const graphRouter = Router({ mergeParams: true });

graphRouter.get("/", resolveRepo, async (req, res) => {
  try {
    const repo = req.repo!;
    // Cheap (one for-each-ref call) vs. the full log walk + layout below — most /graph requests
    // (the 30s poll, every SSE "changed" event, a manual refresh) find nothing has actually
    // moved since last time, so this alone turns most of them into a cache hit instead of a full
    // recompute + retransfer of the whole graph.
    const signature = await getRefTipsSignature(repo.path);
    const cached = getCachedGraph(repo.id, signature);
    if (cached) {
      res.json(cached);
      return;
    }
    const commits = await getCommitLog(repo.path);
    const result = layoutGraph(commits);
    setCachedGraph(repo.id, signature, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "git_error", message: (err as Error).message });
  }
});
