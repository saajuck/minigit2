import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { diffRouter } from "./routes/diff";
import { graphRouter } from "./routes/graph";
import { reposRouter } from "./routes/repos";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4300);

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/repos", reposRouter);
app.use("/api/repos/:id/graph", graphRouter);
app.use("/api/repos/:id/commits", diffRouter);

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
