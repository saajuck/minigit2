import type { NextFunction, Request, Response } from "express";
import type { RepoInfo } from "@minigit2/shared";
import { findRepo } from "../store/repoStore";

declare module "express-serve-static-core" {
  interface Request {
    repo?: RepoInfo;
  }
}

export function resolveRepo(req: Request, res: Response, next: NextFunction): void {
  const repo = findRepo(req.params.id as string);
  if (!repo) {
    res.status(404).json({ error: "not_found", message: "Repo not found" });
    return;
  }
  req.repo = repo;
  next();
}
