import { Router } from "express";
import { fetchAll } from "../git/fetch";
import { resolveRepo } from "../middleware/resolveRepo";

export const fetchRouter = Router({ mergeParams: true });

fetchRouter.post("/", resolveRepo, async (req, res) => {
  try {
    await fetchAll(req.repo!.path);
    res.json({ ok: true });
  } catch (err) {
    // 500, not 502, for consistency with every other route's failed-git-command status — this
    // isn't proxying an upstream HTTP request, so 502 never fit particularly well. Kept as its
    // own "fetch_error" code rather than the shared git_error, though: opportunistic background
    // fetches (offline, no remote, missing credential) are routine, not something to toast the
    // user about, and the client's SILENT_CODES list (client/src/api/client.ts) keys off that
    // code string, not the HTTP status.
    res.status(500).json({ error: "fetch_error", message: (err as Error).message });
  }
});
