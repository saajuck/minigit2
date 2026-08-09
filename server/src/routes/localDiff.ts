import { Router } from "express";
import { getLocalDiffFileList, getLocalDiffFilePatch } from "../git/localDiff";
import { resolveRepo } from "../middleware/resolveRepo";

export const localDiffRouter = Router({ mergeParams: true });

localDiffRouter.get("/", resolveRepo, async (req, res) => {
  try {
    const files = await getLocalDiffFileList(req.repo!.path);
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: "git_error", message: (err as Error).message });
  }
});

localDiffRouter.get("/file", resolveRepo, async (req, res) => {
  const filePath = req.query.path;
  if (typeof filePath !== "string" || filePath.trim() === "") {
    res.status(400).json({ error: "invalid_path", message: "path is required" });
    return;
  }
  try {
    const patch = await getLocalDiffFilePatch(req.repo!.path, filePath);
    res.json({ path: filePath, patch });
  } catch (err) {
    res.status(500).json({ error: "git_error", message: (err as Error).message });
  }
});
