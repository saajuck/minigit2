import { Router, type Response } from "express";
import { getFileBlame } from "../git/blame";
import { getCommitFileList, getCommitFilePatch } from "../git/diff";
import { isMissingObjectError } from "../git/errorClassification";
import { getFilesHotspot } from "../git/hotspot";
import { resolveRepo } from "../middleware/resolveRepo";

export const diffRouter = Router({ mergeParams: true });

const COMMIT_NOT_FOUND_MESSAGE =
  "This commit is no longer in the repository — history may have been rewritten or pruned since the graph was loaded.";

function respondGitError(res: Response, err: unknown) {
  if (isMissingObjectError(err)) {
    res.status(404).json({ error: "commit_not_found", message: COMMIT_NOT_FOUND_MESSAGE });
    return;
  }
  res.status(500).json({ error: "git_error", message: (err as Error).message });
}

diffRouter.get("/:hash/diff", resolveRepo, async (req, res) => {
  try {
    const diff = await getCommitFileList(req.repo!.path, req.params.hash as string);
    res.json(diff);
  } catch (err) {
    respondGitError(res, err);
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
    respondGitError(res, err);
  }
});

diffRouter.post("/:hash/hotspot", resolveRepo, async (req, res) => {
  // POST with the path list in the body, not a GET query string — a commit touching thousands
  // of files (a lockfile bump, a big rename sweep) would otherwise build a query string past
  // the server's header-size limit and fail outright with 431, on exactly the commits where
  // batching mattered most.
  const raw = req.body?.paths;
  const paths = (Array.isArray(raw) ? raw : []).filter(
    (p): p is string => typeof p === "string" && p.trim() !== "",
  );
  if (paths.length === 0) {
    res.status(400).json({ error: "invalid_path", message: "at least one path is required" });
    return;
  }
  try {
    const hotspot = await getFilesHotspot(req.repo!.path, paths);
    res.json(hotspot);
  } catch (err) {
    // Own error code (not the shared "git_error") — fetched automatically whenever a diff is
    // opened, not user-triggered, so a failure here shouldn't toast (same reasoning as the
    // opportunistic background remote fetch's "fetch_error").
    res.status(500).json({ error: "hotspot_error", message: (err as Error).message });
  }
});

diffRouter.get("/:hash/blame", resolveRepo, async (req, res) => {
  const filePath = req.query.path;
  if (typeof filePath !== "string" || filePath.trim() === "") {
    res.status(400).json({ error: "invalid_path", message: "path is required" });
    return;
  }
  try {
    const blame = await getFileBlame(req.repo!.path, req.params.hash as string, filePath);
    res.json(blame);
  } catch (err) {
    respondGitError(res, err);
  }
});
