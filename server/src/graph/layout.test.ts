import { describe, expect, it } from "vitest";
import type { RawCommit } from "../git/log";
import { layoutGraph } from "./layout";

function commit(hash: string, parents: string[]): RawCommit {
  return {
    hash,
    parents,
    author: "Test",
    authorEmail: "test@example.com",
    date: "2026-01-01T00:00:00Z",
    subject: hash,
    refs: [],
  };
}

describe("layoutGraph", () => {
  it("keeps a linear chain on a single lane", () => {
    const commits = [commit("A", ["B"]), commit("B", ["C"]), commit("C", [])];
    const { nodes, edges } = layoutGraph(commits);

    expect(nodes.map((n) => n.lane)).toEqual([0, 0, 0]);
    expect(nodes.map((n) => n.row)).toEqual([0, 1, 2]);
    expect(edges).toEqual([
      { from: "A", to: "B", fromLane: 0, toLane: 0 },
      { from: "B", to: "C", fromLane: 0, toLane: 0 },
    ]);
  });

  it("gives the root commit an empty parents list and frees its lane", () => {
    const commits = [commit("A", [])];
    const { nodes, edges } = layoutGraph(commits);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ hash: "A", row: 0, lane: 0, parents: [] });
    expect(edges).toEqual([]);
  });

  it("lays out a fork (one parent, two children) with both children converging on the parent's lane", () => {
    // A and B both branch off Base; no merge back.
    const commits = [commit("A", ["Base"]), commit("B", ["Base"]), commit("Base", [])];
    const { nodes, edges } = layoutGraph(commits);

    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get("A")!.lane).toBe(0);
    expect(byHash.get("B")!.lane).toBe(1);
    expect(byHash.get("Base")!.lane).toBe(0); // claimed by A, the topologically-earlier child

    expect(edges).toEqual([
      { from: "A", to: "Base", fromLane: 0, toLane: 0 },
      { from: "B", to: "Base", fromLane: 1, toLane: 0 },
    ]);
  });

  it("lays out a merge commit: first parent stays on the mainline lane, second parent gets a new lane", () => {
    // M merges A and B, which both descend from Base.
    const commits = [commit("M", ["A", "B"]), commit("A", ["Base"]), commit("B", ["Base"]), commit("Base", [])];
    const { nodes, edges } = layoutGraph(commits);

    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    expect(byHash.get("M")!.lane).toBe(0);
    expect(byHash.get("A")!.lane).toBe(0); // first parent continues the mainline lane
    expect(byHash.get("B")!.lane).toBe(1); // second parent gets a fresh lane
    expect(byHash.get("Base")!.lane).toBe(0); // claimed by A (topologically earlier), B's edge curves into it

    expect(edges).toEqual([
      { from: "M", to: "A", fromLane: 0, toLane: 0 },
      { from: "M", to: "B", fromLane: 0, toLane: 1 },
      { from: "A", to: "Base", fromLane: 0, toLane: 0 },
      { from: "B", to: "Base", fromLane: 1, toLane: 0 },
    ]);
  });

  it("recycles a freed lane for an unrelated later branch", () => {
    // Two completely independent single-commit histories.
    const commits = [commit("X", []), commit("Y", [])];
    const { nodes } = layoutGraph(commits);

    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    // X frees lane 0 immediately (root, no parents), so Y should reuse it rather than growing to lane 1.
    expect(byHash.get("X")!.lane).toBe(0);
    expect(byHash.get("Y")!.lane).toBe(0);
  });
});
