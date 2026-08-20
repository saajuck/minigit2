import { readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Router } from "express";
import type { FsListResponse } from "@minigit2/shared";

export const fsRouter = Router();

fsRouter.get("/", async (req, res) => {
  // No root restriction, by design: the app's whole threat model already treats any absolute
  // path as fair game (POST /api/repos accepts one directly), so this only adds a way to
  // *discover* paths visually, not a new capability. Still shares P0.1's CSRF-via-GET exposure —
  // a hostile page open in the same browser while minigit2 runs can enumerate directory names
  // (not contents) anywhere on disk by driving this endpoint, same class of issue as the ref/hash
  // injection P0.1 fixed for the git-command routes, just with directory names instead of file
  // contents as the payload. Low severity on its own; noted here so it isn't rediscovered as if
  // it were a new, separate finding.
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
