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
  it("keeps a linear chain on a single lane and colorGroup", () => {
    const commits = [commit("A", ["B"]), commit("B", ["C"]), commit("C", [])];
    const { nodes, edges } = layoutGraph(commits);

    expect(nodes.map((n) => n.lane)).toEqual([0, 0, 0]);
    expect(nodes.map((n) => n.colorGroup)).toEqual([0, 0, 0]);
    expect(nodes.map((n) => n.row)).toEqual([0, 1, 2]);
    expect(edges).toEqual([
      { from: "A", to: "B", fromLane: 0, toLane: 0, colorGroup: 0 },
      { from: "B", to: "C", fromLane: 0, toLane: 0, colorGroup: 0 },
    ]);
  });

  it("gives the root commit an empty parents list and frees its lane", () => {
    const commits = [commit("A", [])];
    const { nodes, edges } = layoutGraph(commits);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ hash: "A", row: 0, lane: 0, colorGroup: 0, parents: [] });
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
    // A and B are separate branches (distinct colorGroups); Base inherits A's, since A claimed
    // it first — not a third, fresh color of its own.
    expect(byHash.get("A")!.colorGroup).toBe(0);
    expect(byHash.get("B")!.colorGroup).toBe(1);
    expect(byHash.get("Base")!.colorGroup).toBe(0);

    expect(edges).toEqual([
      { from: "A", to: "Base", fromLane: 0, toLane: 0, colorGroup: 0 },
      { from: "B", to: "Base", fromLane: 1, toLane: 0, colorGroup: 0 },
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
    // M and A share one colorGroup (mainline, unbroken by the merge); B keeps its own
    // colorGroup throughout, even once its lane number gets reclaimed at Base.
    expect(byHash.get("M")!.colorGroup).toBe(0);
    expect(byHash.get("A")!.colorGroup).toBe(0);
    expect(byHash.get("B")!.colorGroup).toBe(1);
    expect(byHash.get("Base")!.colorGroup).toBe(0);

    expect(edges).toEqual([
      { from: "M", to: "A", fromLane: 0, toLane: 0, colorGroup: 0 },
      { from: "M", to: "B", fromLane: 0, toLane: 1, colorGroup: 1 },
      { from: "A", to: "Base", fromLane: 0, toLane: 0, colorGroup: 0 },
      { from: "B", to: "Base", fromLane: 1, toLane: 0, colorGroup: 0 },
    ]);
  });

  it("keeps the mainline's colorGroup unbroken even when a side branch's row is processed first", () => {
    // c3 -> M2(c2, f2) -> c2 -> M1(c1, f1) -> c1 -> c0
    //                  \-> f2 -> M1                  \-> f1 -> c0
    // Row order (topo, as git would emit it: children before parents, newest-dated first)
    // puts f2 *before* c2, and f1 *before* c1 — both branch off exactly as recent activity on
    // an otherwise-older mainline commit, the same shape that reproduced "master" rendering in
    // a different color after a merge. Mainline (c3/M2/c2/M1/c1/c0) must stay one colorGroup
    // throughout regardless: f2 and f1 reaching M1/c0 first in row order must not steal them.
    const commits = [
      commit("c3", ["M2"]),
      commit("M2", ["c2", "f2"]),
      commit("f2", ["M1"]),
      commit("c2", ["M1"]),
      commit("M1", ["c1", "f1"]),
      commit("f1", ["c0"]),
      commit("c1", ["c0"]),
      commit("c0", []),
    ];
    const { nodes } = layoutGraph(commits);
    const byHash = new Map(nodes.map((n) => [n.hash, n]));

    const mainlineGroup = byHash.get("c3")!.colorGroup;
    for (const hash of ["M2", "c2", "M1", "c1", "c0"]) {
      expect(byHash.get(hash)!.colorGroup).toBe(mainlineGroup);
    }
    expect(byHash.get("f2")!.colorGroup).not.toBe(mainlineGroup);
    expect(byHash.get("f1")!.colorGroup).not.toBe(mainlineGroup);
  });

  it("recycles a freed lane for an unrelated later branch", () => {
    // Two completely independent single-commit histories.
    const commits = [commit("X", []), commit("Y", [])];
    const { nodes } = layoutGraph(commits);

    const byHash = new Map(nodes.map((n) => [n.hash, n]));
    // X frees lane 0 immediately (root, no parents), so Y should reuse it rather than growing to lane 1.
    expect(byHash.get("X")!.lane).toBe(0);
    expect(byHash.get("Y")!.lane).toBe(0);
    // colorGroups are never recycled the way lanes are, even though both commits share lane 0 —
    // otherwise two unrelated branches that happen to land on the same freed lane would render
    // as the same color.
    expect(byHash.get("X")!.colorGroup).toBe(0);
    expect(byHash.get("Y")!.colorGroup).toBe(1);
  });
});
