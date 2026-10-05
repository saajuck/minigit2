import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { watchRefPaths } from "./watch";

function makeRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "minigit2-watch-"));
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", dir, "-c", "user.email=t@t", "-c", "user.name=t", ...args]);
  git("init", "-q");
  git("commit", "-q", "--allow-empty", "-m", "first");
  return dir;
}

describe("watchRefPaths", () => {
  const dirs: string[] = [];
  const open: ReturnType<typeof watchRefPaths> = [];

  afterEach(() => {
    for (const w of open.splice(0)) w.close();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("watches the ref paths a fresh repo has", () => {
    const dir = makeRepo();
    dirs.push(dir);
    const watchers = watchRefPaths(path.join(dir, ".git"), () => {});
    open.push(...watchers);
    expect(watchers.length).toBeGreaterThan(0);
  });

  // The regression this file exists for: Node implements `recursive: true` by re-scanning
  // subdirectories on change, and emits 'error' on the FSWatcher if one vanished mid-scan
  // (`ENOENT: scandir .git/refs/heads`, routine when a repo is deleted or the last ref under a
  // prefix goes away). With no listener attached, that emit *throws* out of an internal fs
  // callback and takes the whole server process down — which is exactly how CI lost its server
  // between two e2e tests. Emitting it by hand is the deterministic way to assert the guard:
  // EventEmitter#emit rethrows an 'error' nobody listens for.
  it("survives an 'error' on a watcher instead of throwing", () => {
    const dir = makeRepo();
    dirs.push(dir);
    const watchers = watchRefPaths(path.join(dir, ".git"), () => {});
    open.push(...watchers);

    for (const watcher of watchers) {
      expect(watcher.listenerCount("error")).toBeGreaterThan(0);
      expect(() => watcher.emit("error", new Error("ENOENT: scandir, simulated"))).not.toThrow();
    }
  });

  it("skips paths that don't exist without failing the others", () => {
    const dir = makeRepo();
    dirs.push(dir);
    rmSync(path.join(dir, ".git", "logs"), { recursive: true, force: true });
    const watchers = watchRefPaths(path.join(dir, ".git"), () => {});
    open.push(...watchers);
    expect(watchers.length).toBe(2);
  });
});
