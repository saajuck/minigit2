import { describe, expect, it } from "vitest";
import type { GraphResponse } from "@minigit2/shared";
import { getCachedGraph, setCachedGraph } from "./graphCache";

// The cache is a module-level singleton, so each test uses its own repo id to stay isolated
// from the others rather than resetting shared state between them. A fresh {nodes:[],edges:[]}
// each call is distinct by reference, which is all these tests need (toBe checks identity).
function emptyGraph(): GraphResponse {
  return { nodes: [], edges: [] };
}

describe("graphCache", () => {
  it("returns null for a repo that's never been cached", () => {
    expect(getCachedGraph("repo-never-cached", "sig-a")).toBeNull();
  });

  it("returns the cached result when the signature still matches", () => {
    const result = emptyGraph();
    setCachedGraph("repo-hit", "sig-a", result);
    expect(getCachedGraph("repo-hit", "sig-a")).toBe(result);
  });

  it("returns null when the signature has changed (a ref moved, was added, or was removed)", () => {
    setCachedGraph("repo-stale", "sig-a", emptyGraph());
    expect(getCachedGraph("repo-stale", "sig-b")).toBeNull();
  });

  it("keeps different repos' cached results independent", () => {
    const resultA = emptyGraph();
    const resultB = emptyGraph();
    setCachedGraph("repo-1", "sig", resultA);
    setCachedGraph("repo-2", "sig", resultB);
    expect(getCachedGraph("repo-1", "sig")).toBe(resultA);
    expect(getCachedGraph("repo-2", "sig")).toBe(resultB);
  });

  it("overwrites the previous entry for the same repo", () => {
    setCachedGraph("repo-overwrite", "sig-a", emptyGraph());
    const resultB = emptyGraph();
    setCachedGraph("repo-overwrite", "sig-b", resultB);
    expect(getCachedGraph("repo-overwrite", "sig-a")).toBeNull();
    expect(getCachedGraph("repo-overwrite", "sig-b")).toBe(resultB);
  });
});
