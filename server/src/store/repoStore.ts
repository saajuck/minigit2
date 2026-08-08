import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { RepoInfo } from "@minigit2/shared";

const CONFIG_DIR = path.join(os.homedir(), ".minigit-gui");
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
