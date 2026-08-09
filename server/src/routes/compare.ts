import { Router, type Request } from "express";
import { getCompareFileList, getCompareFilePatch } from "../git/diff";
import { resolveRepo } from "../middleware/resolveRepo";

export const compareRouter = Router({ mergeParams: true });

function readFromTo(req: Request): { from: string; to: string } | null {
  const from = req.query.from;
  const to = req.query.to;
  if (typeof from !== "string" || from.trim() === "" || typeof to !== "string" || to.trim() === "") {
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
    res.status(500).json({ error: "git_error", message: (err as Error).message });
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
    res.status(500).json({ error: "git_error", message: (err as Error).message });
  }
});
