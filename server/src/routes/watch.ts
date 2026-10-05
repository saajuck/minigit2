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

/** Watches the three ref paths that matter, tolerating both kinds of absence: a path that isn't
 * there when we start (a brand-new repo has no reflog yet), and a path that disappears while
 * we're watching it.
 *
 * The second case is the one that bites. Node implements `recursive: true` by re-scanning
 * subdirectories whenever something changes, and if a directory vanished mid-scan the FSWatcher
 * emits `'error'` (`ENOENT: scandir .git/refs/heads`). That is routine — removing the last ref
 * under a prefix deletes its directory, and deleting or moving the repo deletes all of them —
 * but an unhandled `'error'` on an EventEmitter *throws*, which took the entire server process
 * down with it. Treat it as "stop watching this path": the client still has its 30s poll, and a
 * missing repo has nothing left to report anyway.
 *
 * Exported for the test, which needs the watchers themselves to assert the handler is attached. */
export function watchRefPaths(gitDir: string, notify: () => void): FSWatcher[] {
  const watchers: FSWatcher[] = [];
  for (const target of [["HEAD"], ["refs"], ["logs", "HEAD"]]) {
    try {
      const watcher = watch(path.join(gitDir, ...target), { recursive: target[0] === "refs" }, notify);
      watcher.on("error", () => watcher.close());
      watchers.push(watcher);
    } catch {
      // path doesn't exist (yet) — skip it, the others still watch
    }
  }
  return watchers;
}

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

  const watchers = watchRefPaths(gitDir, notify);

  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), HEARTBEAT_MS);

  req.on("close", () => {
    clearTimeout(debounceTimer);
    clearInterval(heartbeat);
    for (const w of watchers) w.close();
  });
});
