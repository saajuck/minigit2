import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { RepoInfo } from "@minigit2/shared";

// Overridable so tests can point at a throwaway directory instead of the real home directory —
// same pattern as MINIGIT2_CLIENT_DIST in index.ts.
const CONFIG_DIR = process.env.MINIGIT2_CONFIG_DIR ?? path.join(os.homedir(), ".minigit-gui");
const CONFIG_FILE = path.join(CONFIG_DIR, "repos.json");

function load(): RepoInfo[] {
  if (!existsSync(CONFIG_FILE)) return [];
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as RepoInfo[];
  } catch {
    return [];
  }
}

function save(repos: RepoInfo[]): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(repos, null, 2), "utf-8");
}

// addRepo/removeRepo below are plain synchronous functions with no `await` between their load()
// and save() calls. That's the actual safety property, not incidental: Node's single-threaded,
// non-preemptive event loop guarantees a synchronous stretch of code (this whole
// load-modify-save sequence) always runs to completion before any other request handler's code
// gets a turn — even though two POST /api/repos requests can race each other up to the point
// they call addRepo (each awaits assertValidRepoPath first), the read-modify-write itself can't
// interleave. Losing that property (e.g. switching to fs/promises, or awaiting anything between
// load() and save()) would reintroduce a real lost-update race — see repoStore.test.ts's
// concurrency test, which fails if that invariant breaks.

export function listRepos(): RepoInfo[] {
  return load();
}

export function findRepo(id: string): RepoInfo | undefined {
  return load().find((r) => r.id === id);
}

export function findRepoByPath(absPath: string): RepoInfo | undefined {
  return load().find((r) => r.path === absPath);
}

export function addRepo(absPath: string): RepoInfo {
  const repos = load();
  const repo: RepoInfo = {
    id: randomUUID(),
    path: absPath,
    name: path.basename(absPath),
    addedAt: new Date().toISOString(),
  };
  repos.push(repo);
  save(repos);
  return repo;
}

export function removeRepo(id: string): boolean {
  const repos = load();
  const next = repos.filter((r) => r.id !== id);
  if (next.length === repos.length) return false;
  save(next);
  return true;
}
