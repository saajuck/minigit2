import { Router } from "express";
import { getLocalDiffFileList, getLocalDiffFilePatch } from "../git/localDiff";
import { resolveRepo } from "../middleware/resolveRepo";
import { respondGitError } from "./errorResponse";

export const localDiffRouter = Router({ mergeParams: true });

localDiffRouter.get("/", resolveRepo, async (req, res) => {
  try {
    const files = await getLocalDiffFileList(req.repo!.path);
    res.json({ files });
  } catch (err) {
    respondGitError(res, err);
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
    respondGitError(res, err);
  }
});
