import { readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Router } from "express";
import type { FsListResponse } from "@minigit2/shared";

export const fsRouter = Router();

fsRouter.get("/", async (req, res) => {
  const rawPath = typeof req.query.path === "string" && req.query.path.trim() !== "" ? req.query.path : os.homedir();
  const target = path.resolve(rawPath);

  let entries;
  try {
    entries = await readdir(target, { withFileTypes: true });
  } catch (err) {
    res.status(400).json({ error: "not_a_directory", message: (err as Error).message });
    return;
  }

  const directories = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => ({ name: e.name, path: path.join(target, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const parent = path.dirname(target) === target ? null : path.dirname(target);

  const response: FsListResponse = { path: target, parent, directories };
  res.json(response);
});
