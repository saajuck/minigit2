import compression from "compression";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { branchesRouter } from "./routes/branches";
import { checkoutRouter } from "./routes/checkout";
import { compareRouter } from "./routes/compare";
import { diffRouter } from "./routes/diff";
import { fetchRouter } from "./routes/fetch";
import { fsRouter } from "./routes/fs";
import { graphRouter } from "./routes/graph";
import { localDiffRouter } from "./routes/localDiff";
import { reflogRouter } from "./routes/reflog";
import { reposRouter } from "./routes/repos";
import { searchRouter } from "./routes/search";
import { stashRouter } from "./routes/stash";
import { statusRouter } from "./routes/status";
import { watchRouter } from "./routes/watch";

/** Deferred so a bundled/packaged build (no real source file on disk to resolve `import.meta.url`
 * against) can skip straight to the env var instead of throwing before the check even runs. The
 * fallback itself is also guarded: Tauri always sets MINIGIT2_CLIENT_DIST before spawning the
 * sidecar, but the same Node SEA binary run standalone (no Tauri host, e.g. for local debugging)
 * has an unresolvable import.meta.url and would otherwise crash on startup before the server
 * could even bind a port — an empty, guaranteed-nonexistent path just means static serving is
 * skipped below instead. */
function resolveClientDist(): string {
  if (process.env.MINIGIT2_CLIENT_DIST) return process.env.MINIGIT2_CLIENT_DIST;
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(dir, "../../client/dist");
  } catch (err) {
    console.warn(
      "minigit2: could not resolve the client dist directory (MINIGIT2_CLIENT_DIST is unset and " +
        "import.meta.url is unresolvable) — static file serving is disabled; the API still works.",
      err,
    );
    return "";
  }
}

const PORT = Number(process.env.PORT ?? 4300);

const app = express();
app.use(express.json());
// Skip the SSE watch stream explicitly rather than trust compression's own content-type
// heuristics — gzip buffers output, which would delay/break a stream that's supposed to flush
// each event immediately. Worth it for the graph endpoint especially: a large repo's full
// {nodes,edges} JSON can run into the megabytes.
app.use(compression({ filter: (req, res) => req.path.endsWith("/watch") === false && compression.filter(req, res) }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/fs", fsRouter);
app.use("/api/repos", reposRouter);
app.use("/api/repos/:id/graph", graphRouter);
app.use("/api/repos/:id/commits", diffRouter);
app.use("/api/repos/:id/compare", compareRouter);
app.use("/api/repos/:id/status", statusRouter);
app.use("/api/repos/:id/checkout", checkoutRouter);
app.use("/api/repos/:id/fetch", fetchRouter);
app.use("/api/repos/:id/stash", stashRouter);
app.use("/api/repos/:id/reflog", reflogRouter);
app.use("/api/repos/:id/local-diff", localDiffRouter);
app.use("/api/repos/:id/branches", branchesRouter);
app.use("/api/repos/:id/search", searchRouter);
app.use("/api/repos/:id/watch", watchRouter);

const clientDist = resolveClientDist();
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const server = app.listen(PORT, "127.0.0.1", () => {
  const address = server.address();
  // When PORT=0 (the packaged Tauri app's sidecar), the OS picks the actual port — log that
  // real value, not the literal 0, since the Tauri shell parses this line to find it.
  const actualPort = typeof address === "object" && address !== null ? address.port : PORT;
  console.log(`minigit2 server listening on http://127.0.0.1:${actualPort}`);
});
