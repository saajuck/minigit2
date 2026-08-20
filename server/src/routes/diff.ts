import { Router } from "express";
import { getFileBlame } from "../git/blame";
import { getCommitFileList, getCommitFilePatch } from "../git/diff";
import { getFilesHotspot } from "../git/hotspot";
import { getCachedHotspot, setCachedHotspot } from "../git/hotspotCache";
import { getRefTipsSignature } from "../git/refTips";
import { resolveRepo } from "../middleware/resolveRepo";
import { validateHashParam } from "../middleware/validateRef";
import { respondGitError } from "./errorResponse";

export const diffRouter = Router({ mergeParams: true });
diffRouter.param("hash", validateHashParam);

const COMMIT_NOT_FOUND_MESSAGE =
  "This commit is no longer in the repository — history may have been rewritten or pruned since the graph was loaded.";

diffRouter.get("/:hash/diff", resolveRepo, async (req, res) => {
  try {
    const diff = await getCommitFileList(req.repo!.path, req.params.hash as string);
    res.json(diff);
  } catch (err) {
    respondGitError(res, err, COMMIT_NOT_FOUND_MESSAGE);
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
    respondGitError(res, err, COMMIT_NOT_FOUND_MESSAGE);
  }
});

diffRouter.get("/:hash/hotspot", resolveRepo, async (req, res) => {
  try {
    // No path list from the client — the touched files are derived from the hash server-side
    // (see getFilesHotspot), so this never has to ship a path list either direction.
    const repo = req.repo!;
    const hash = req.params.hash as string;
    // getFilesHotspot walks the whole --all history, same cost every time a diff is opened —
    // cache it per (repo, hash), invalidated by the same ref-tip signature the graph cache uses
    // (a hotspot counts every commit reachable from any ref right now, so it's just as sensitive
    // to a ref moving as the graph itself is).
    const signature = await getRefTipsSignature(repo.path);
    const cached = getCachedHotspot(repo.id, hash, signature);
    if (cached) {
      res.json(cached);
      return;
    }
    const hotspot = await getFilesHotspot(repo.path, hash);
    setCachedHotspot(repo.id, hash, signature, hotspot);
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
    respondGitError(res, err, COMMIT_NOT_FOUND_MESSAGE);
  }
});
