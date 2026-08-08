import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkoutRouter } from "./routes/checkout";
import { diffRouter } from "./routes/diff";
import { fsRouter } from "./routes/fs";
import { graphRouter } from "./routes/graph";
import { reposRouter } from "./routes/repos";
import { statusRouter } from "./routes/status";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
app.use("/api/repos/:id/status", statusRouter);
app.use("/api/repos/:id/checkout", checkoutRouter);

const clientDist = path.resolve(__dirname, "../../client/dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(PORT, "127.0.0.1", () => {
  console.log(`minigit2 server listening on http://127.0.0.1:${PORT}`);
});
