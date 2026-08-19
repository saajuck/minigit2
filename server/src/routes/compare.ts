import { Router, type Request, type Response } from "express";
import { getCompareFileList, getCompareFilePatch } from "../git/diff";
import { isMissingObjectError } from "../git/errorClassification";
import { isUnsafeRef } from "../git/exec";
import { resolveRepo } from "../middleware/resolveRepo";

export const compareRouter = Router({ mergeParams: true });

const COMMIT_NOT_FOUND_MESSAGE =
  "One of these commits is no longer in the repository — history may have been rewritten or pruned since the graph was loaded.";

function respondGitError(res: Response, err: unknown) {
  if (isMissingObjectError(err)) {
    res.status(404).json({ error: "commit_not_found", message: COMMIT_NOT_FOUND_MESSAGE });
    return;
  }
  res.status(500).json({ error: "git_error", message: (err as Error).message });
}

function readFromTo(req: Request): { from: string; to: string } | null {
  const from = req.query.from;
  const to = req.query.to;
  if (typeof from !== "string" || from.trim() === "" || typeof to !== "string" || to.trim() === "") {
    return null;
  }
  if (isUnsafeRef(from) || isUnsafeRef(to)) {
    return null;
  }
  return { from, to };
}

compareRouter.get("/", resolveRepo, async (req, res) => {
  const refs = readFromTo(req);
  if (!refs) {
    res.status(400).json({ error: "invalid_refs", message: "from and to are required" });
    return;
  }
  try {
    const compare = await getCompareFileList(req.repo!.path, refs.from, refs.to);
    res.json(compare);
  } catch (err) {
    respondGitError(res, err);
  }
});

compareRouter.get("/file", resolveRepo, async (req, res) => {
  const refs = readFromTo(req);
  const filePath = req.query.path;
  if (!refs || typeof filePath !== "string" || filePath.trim() === "") {
    res.status(400).json({ error: "invalid_request", message: "from, to, and path are required" });
    return;
  }
  try {
    const patch = await getCompareFilePatch(req.repo!.path, refs.from, refs.to, filePath);
    res.json({ path: filePath, patch });
  } catch (err) {
    respondGitError(res, err);
  }
});
