import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// repoStore reads its config directory from MINIGIT2_CONFIG_DIR (falling back to the real home
// directory) once at module load time, so each test points that env var at a fresh temp dir and
// re-imports the module to pick it up — vi.resetModules() forces a fresh module instance rather
// than reusing one cached from an earlier test with a different CONFIG_DIR baked in.
let tmpDir: string;

async function freshStore() {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "minigit2-repostore-"));
  process.env.MINIGIT2_CONFIG_DIR = tmpDir;
  const { vi } = await import("vitest");
  vi.resetModules();
  return import("./repoStore");
}

beforeEach(() => {
  tmpDir = "";
});

afterEach(() => {
  delete process.env.MINIGIT2_CONFIG_DIR;
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("repoStore", () => {
  it("starts empty and persists an added repo", async () => {
    const store = await freshStore();
    expect(store.listRepos()).toEqual([]);
    const repo = store.addRepo("/home/alice/project");
    expect(repo.path).toBe("/home/alice/project");
    expect(repo.name).toBe("project");
    expect(store.listRepos()).toEqual([repo]);
    expect(store.findRepo(repo.id)).toEqual(repo);
    expect(store.findRepoByPath("/home/alice/project")).toEqual(repo);
  });

  it("removes a repo by id and reports false for an unknown id", async () => {
    const store = await freshStore();
    const repo = store.addRepo("/home/alice/project");
    expect(store.removeRepo("does-not-exist")).toBe(false);
    expect(store.removeRepo(repo.id)).toBe(true);
    expect(store.listRepos()).toEqual([]);
  });

  it("survives many interleaved async addRepo calls with no lost updates", async () => {
    const store = await freshStore();
    // Mirrors the real route handler's shape: an await (here, a microtask/macrotask hop
    // standing in for assertValidRepoPath's real git subprocess call) before the synchronous
    // load-modify-save. If a future change made load()/save() themselves async, this is the
    // test that would start failing by losing some of these 20 repos.
    const additions = Array.from({ length: 20 }, (_, i) =>
      new Promise<void>((resolve) => setTimeout(resolve, i % 3)).then(() => store.addRepo(`/repos/repo-${i}`)),
    );
    await Promise.all(additions);
    expect(store.listRepos()).toHaveLength(20);
    const paths = new Set(store.listRepos().map((r) => r.path));
    for (let i = 0; i < 20; i++) {
      expect(paths.has(`/repos/repo-${i}`)).toBe(true);
    }
  });
});
