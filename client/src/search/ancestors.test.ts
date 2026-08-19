import { describe, expect, it } from "vitest";
import type { CommitNode } from "@minigit2/shared";
import { ancestorHashes } from "./ancestors";

function node(hash: string, parents: string[]): CommitNode {
  return {
    hash,
    parents,
    row: 0,
    lane: 0,
    colorGroup: 0,
    author: "Test",
    authorEmail: "test@example.com",
    authorAvatarUrl: "",
    date: "2026-01-01T00:00:00Z",
    subject: hash,
    refs: [],
  };
}

function byHashOf(nodes: CommitNode[]): Map<string, CommitNode> {
  return new Map(nodes.map((n) => [n.hash, n]));
}

describe("ancestorHashes", () => {
  it("walks a linear chain back to the root", () => {
    const nodes = [node("C", ["B"]), node("B", ["A"]), node("A", [])];
    expect(ancestorHashes(byHashOf(nodes), ["C"])).toEqual(new Set(["C", "B", "A"]));
  });

  it("includes the start hash itself even with no parents", () => {
    const nodes = [node("A", [])];
    expect(ancestorHashes(byHashOf(nodes), ["A"])).toEqual(new Set(["A"]));
  });

  it("unions the ancestors of multiple start hashes", () => {
    // Two separate chains, no shared history.
    const nodes = [node("B1", ["A1"]), node("A1", []), node("B2", ["A2"]), node("A2", [])];
    expect(ancestorHashes(byHashOf(nodes), ["B1", "B2"])).toEqual(new Set(["B1", "A1", "B2", "A2"]));
  });

  it("doesn't revisit a commit reachable through two different paths (fork + merge)", () => {
    const nodes = [node("M", ["A", "B"]), node("A", ["Base"]), node("B", ["Base"]), node("Base", [])];
    // Base is reachable via both A and B — must appear once, and the walk must terminate rather
    // than looping or double-processing it.
    expect(ancestorHashes(byHashOf(nodes), ["M"])).toEqual(new Set(["M", "A", "B", "Base"]));
  });

  it("stops at a parent hash that isn't in the graph (e.g. a shallow clone boundary)", () => {
    const nodes = [node("A", ["missing-parent"])];
    expect(ancestorHashes(byHashOf(nodes), ["A"])).toEqual(new Set(["A", "missing-parent"]));
  });

  it("returns just the start hash when it isn't itself in the graph", () => {
    expect(ancestorHashes(byHashOf([]), ["unknown"])).toEqual(new Set(["unknown"]));
  });

  it("returns an empty set for no start hashes", () => {
    const nodes = [node("A", [])];
    expect(ancestorHashes(byHashOf(nodes), [])).toEqual(new Set());
  });
});
