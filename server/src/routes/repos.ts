import { Router } from "express";
import type { RepoInfo, RepoSummary } from "@minigit2/shared";
import { assertValidRepoPath, RepoValidationError } from "../git/repoValidation";
import { getRepoStatus } from "../git/status";
import { addRepo, findRepoByPath, listRepos, removeRepo } from "../store/repoStore";

export const reposRouter = Router();

async function toRepoSummary(repo: RepoInfo): Promise<RepoSummary> {
  try {
    const status = await getRepoStatus(repo.path);
    return { ...repo, branch: status.branch, detached: status.detached, dirty: status.dirty };
  } catch {
    return { ...repo, branch: null, detached: false, dirty: false };
  }
}

reposRouter.get("/", async (_req, res) => {
  const repos = await Promise.all(listRepos().map(toRepoSummary));
  res.json({ repos });
});

reposRouter.post("/", async (req, res) => {
  const rawPath = req.body?.path;
  if (typeof rawPath !== "string" || rawPath.trim() === "") {
    res.status(400).json({ error: "invalid_path", message: "path is required" });
    return;
  }

  try {
    const absPath = await assertValidRepoPath(rawPath);
    if (findRepoByPath(absPath)) {
      res.status(409).json({ error: "already_added", message: `Repo already added: ${absPath}` });
      return;
    }
    const repo = addRepo(absPath);
    res.status(201).json({ repo: await toRepoSummary(repo) });
  } catch (err) {
    if (err instanceof RepoValidationError) {
      const status = err.code === "not_a_git_repo" ? 422 : 400;
      res.status(status).json({ error: err.code, message: err.message });
      return;
    }
    res.status(500).json({ error: "internal_error", message: (err as Error).message });
  }
});

reposRouter.delete("/:id", (req, res) => {
  const removed = removeRepo(req.params.id);
  if (!removed) {
    res.status(404).json({ error: "not_found", message: "Repo not found" });
    return;
  }
  res.status(204).end();
});
