import { Router } from "express";
import { watch, type FSWatcher } from "node:fs";
import path from "node:path";
import { resolveRepo } from "../middleware/resolveRepo";

export const watchRouter = Router({ mergeParams: true });

// Git operations often touch several ref files in one go (a fetch updating many
// remote-tracking branches at once) — coalesce that burst into a single notification instead of
// one per file.
const DEBOUNCE_MS = 200;
const HEARTBEAT_MS = 25_000;

/** Server-sent-events stream that notifies the client the moment something changes on disk in
 * this repo's refs — new commits, a checkout, a fetch/pull run outside the app — without waiting
 * for the 30s poll. Deliberately scoped to just HEAD/refs/logs-HEAD, not the working tree: those
 * three are small and their count tracks the number of branches, not the size of the codebase, so
 * this stays cheap regardless of repo size. The watcher only exists for the lifetime of this one
 * connection — matching the app's existing "no server-side active-repo state" design, a repo is
 * watched only while some client is actually looking at it, not permanently for every registered
 * repo. */
watchRouter.get("/", resolveRepo, (req, res) => {
  const gitDir = path.join(req.repo!.path, ".git");

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(": connected\n\n");

  let debounceTimer: NodeJS.Timeout | undefined;
  function notify() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => res.write("event: changed\ndata: {}\n\n"), DEBOUNCE_MS);
  }

  const watchers: FSWatcher[] = [];
  // Each watched path is optional (a brand-new repo may not have a reflog yet, for instance) —
  // one missing path shouldn't stop the others from working.
  for (const target of [["HEAD"], ["refs"], ["logs", "HEAD"]]) {
    try {
      watchers.push(watch(path.join(gitDir, ...target), { recursive: target[0] === "refs" }, notify));
    } catch {
      // path doesn't exist (yet) — skip it, the others still watch
    }
  }

  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), HEARTBEAT_MS);

  req.on("close", () => {
    clearTimeout(debounceTimer);
    clearInterval(heartbeat);
    for (const w of watchers) w.close();
  });
});
