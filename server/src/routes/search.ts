import { Router } from "express";
import { searchCommitsByPath } from "../git/fileSearch";
import { resolveRepo } from "../middleware/resolveRepo";

export const searchRouter = Router({ mergeParams: true });

searchRouter.get("/files", resolveRepo, async (req, res) => {
  const pathspec = req.query.path;
  if (typeof pathspec !== "string" || pathspec.trim() === "") {
    res.status(400).json({ error: "invalid_path", message: "path is required" });
    return;
  }
  try {
    const hashes = await searchCommitsByPath(req.repo!.path, pathspec);
    res.json({ hashes });
  } catch (err) {
    res.status(500).json({ error: "git_error", message: (err as Error).message });
  }
});
