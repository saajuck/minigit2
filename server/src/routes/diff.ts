import { Router } from "express";
import { getCommitFileList, getCommitFilePatch } from "../git/diff";
import { resolveRepo } from "../middleware/resolveRepo";

export const diffRouter = Router({ mergeParams: true });

diffRouter.get("/:hash/diff", resolveRepo, async (req, res) => {
  try {
    const diff = await getCommitFileList(req.repo!.path, req.params.hash as string);
    res.json(diff);
  } catch (err) {
    res.status(500).json({ error: "git_error", message: (err as Error).message });
  }
});

diffRouter.get("/:hash/diff/file", resolveRepo, async (req, res) => {
  const filePath = req.query.path;
  if (typeof filePath !== "string" || filePath.trim() === "") {
    res.status(400).json({ error: "invalid_path", message: "path is required" });
    return;
  }
  try {
    const patch = await getCommitFilePatch(req.repo!.path, req.params.hash as string, filePath);
    res.json({ path: filePath, patch });
  } catch (err) {
    res.status(500).json({ error: "git_error", message: (err as Error).message });
  }
});
