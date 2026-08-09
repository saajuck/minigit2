import { Router } from "express";
import { fetchAll } from "../git/fetch";
import { resolveRepo } from "../middleware/resolveRepo";

export const fetchRouter = Router({ mergeParams: true });

fetchRouter.post("/", resolveRepo, async (req, res) => {
  try {
    await fetchAll(req.repo!.path);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: "fetch_error", message: (err as Error).message });
  }
});
