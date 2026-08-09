import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { branchesRouter } from "./routes/branches";
import { checkoutRouter } from "./routes/checkout";
import { compareRouter } from "./routes/compare";
import { diffRouter } from "./routes/diff";
import { fsRouter } from "./routes/fs";
import { graphRouter } from "./routes/graph";
import { localDiffRouter } from "./routes/localDiff";
import { reflogRouter } from "./routes/reflog";
import { reposRouter } from "./routes/repos";
import { stashRouter } from "./routes/stash";
import { statusRouter } from "./routes/status";

/** Deferred so a bundled/packaged build (no real source file on disk to resolve `import.meta.url`
 * against) can skip straight to the env var instead of throwing before the check even runs. */
function resolveClientDist(): string {
  if (process.env.MINIGIT2_CLIENT_DIST) return process.env.MINIGIT2_CLIENT_DIST;
  const dir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(dir, "../../client/dist");
}

const PORT = Number(process.env.PORT ?? 4300);

const app = express();
app.use(express.json());

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
app.use("/api/repos/:id/stash", stashRouter);
app.use("/api/repos/:id/reflog", reflogRouter);
app.use("/api/repos/:id/local-diff", localDiffRouter);
app.use("/api/repos/:id/branches", branchesRouter);

const clientDist = resolveClientDist();
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(PORT, "127.0.0.1", () => {
  console.log(`minigit2 server listening on http://127.0.0.1:${PORT}`);
});
