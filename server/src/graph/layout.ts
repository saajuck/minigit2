import type { CommitNode, GraphEdge } from "@minigit2/shared";
import { gravatarUrl } from "../git/gravatar";
import type { RawCommit } from "../git/log";

export interface GraphLayout {
  nodes: CommitNode[];
  edges: GraphEdge[];
}

/**
 * Assigns each commit a colorGroup: a persistent id for "which continuous branch run is this
 * commit part of", independent of row order and of the lane layout below. Walks first-parent
 * chains starting from the topmost (newest) unclaimed commit in each pass, exactly like
 * mhutchie/vscode-git-graph's `determinePath` walks one `Branch` continuously via first-parent
 * before ever considering another vertex — so whichever branch is "in progress" always keeps
 * its shared ancestors, rather than losing them to a sibling that merely happens to reach that
 * ancestor first in commit-date order (e.g. a short-lived side branch committed earlier in the
 * day than master's next commit). Assigning colorGroup inline with the row-by-row lane loop
 * below — reserving it forward from whichever child's *row* is processed first — was tried and
 * rejected for exactly this reason: at a fork point with two children, row order can side with
 * either one pretty much arbitrarily, which is how "master" ends up rendered in a different
 * color than its own preceding commits after a merge.
 */
function assignColorGroups(commits: RawCommit[]): { colorGroupOf: Map<string, number>; nextGroup: number } {
  const parentsByHash = new Map(commits.map((c) => [c.hash, c.parents]));
  const colorGroupOf = new Map<string, number>();
  let nextGroup = 0;

  for (const commit of commits) {
    if (colorGroupOf.has(commit.hash)) continue; // already claimed by an earlier, still-running walk
    const group = nextGroup++;
    let cur: string | undefined = commit.hash;
    while (cur !== undefined && !colorGroupOf.has(cur)) {
      colorGroupOf.set(cur, group);
      cur = parentsByHash.get(cur)?.[0];
    }
  }

  return { colorGroupOf, nextGroup };
}

/**
 * Assigns each commit a row (topo order, already given) and a lane (column), greedily
 * reusing the leftmost free lane. A parent already reserved by an earlier child (fork
 * point, or a merge's non-mainline parent) keeps its reserved lane rather than being
 * reassigned by whichever commit reaches it next. A lane can legitimately shift around a
 * merge — colorGroup (see assignColorGroups above) is what stays fixed for a branch's whole
 * run, so the client colors by colorGroup rather than by the row's current lane.
 */
export function layoutGraph(commits: RawCommit[]): GraphLayout {
  const { colorGroupOf, nextGroup: initialNextGroup } = assignColorGroups(commits);
  let nextGroup = initialNextGroup;
  const lanes: (string | null)[] = [];
  const laneOf = new Map<string, number>();
  const nodes: CommitNode[] = [];
  const edges: GraphEdge[] = [];

  // assignColorGroups only walks hashes present in `commits` — a parent hash outside that set
  // (the boundary of a shallow clone, most plausibly) never gets a group from it. Falling back
  // to an `as number` cast there left colorGroup silently `undefined` on the wire, violating
  // GraphEdge's own type. Allocate a fresh group for it here instead, the first time it's seen —
  // there's nothing else known about that commit, so treating it as its own distinct run is the
  // least wrong assumption, and later edges referencing it via the same parentHash correctly
  // reuse the same freshly-allocated group rather than getting yet another new one each time.
  function resolveColorGroup(hash: string): number {
    let group = colorGroupOf.get(hash);
    if (group === undefined) {
      group = nextGroup++;
      colorGroupOf.set(hash, group);
    }
    return group;
  }

  function firstFreeLane(skip?: number): number {
    for (let i = 0; i < lanes.length; i++) {
      if (i === skip) continue;
      if (lanes[i] === null) return i;
    }
    lanes.push(null);
    return lanes.length - 1;
  }

  commits.forEach((commit, row) => {
    let lane: number;
    if (laneOf.has(commit.hash)) {
      lane = laneOf.get(commit.hash) as number;
      laneOf.delete(commit.hash);
    } else {
      lane = firstFreeLane();
    }
    lanes[lane] = null;

    commit.parents.forEach((parentHash, i) => {
      let parentLane: number;
      if (laneOf.has(parentHash)) {
        parentLane = laneOf.get(parentHash) as number;
      } else if (i === 0) {
        parentLane = lane;
      } else {
        parentLane = firstFreeLane(lane);
      }
      lanes[parentLane] = parentHash;
      laneOf.set(parentHash, parentLane);
      // The first-parent edge is this commit's own branch continuing downward, so it must keep
      // the commit's own colorGroup even where the parent is a fan-in point already claimed by a
      // different (earlier-walked) branch — e.g. several branches rooted on the same initial
      // commit, or two branches converging back onto a shared ancestor without a merge commit.
      // Using the parent's colorGroup there would flip this branch's own trailing edge to
      // whichever other branch happened to claim that ancestor first. Non-first parents (merge
      // edges) are a different case: they represent another branch merging in, so they keep that
      // branch's own colorGroup via the parent, exactly as before.
      const colorGroup = i === 0 ? resolveColorGroup(commit.hash) : resolveColorGroup(parentHash);
      edges.push({
        from: commit.hash,
        to: parentHash,
        fromLane: lane,
        toLane: parentLane,
        colorGroup,
      });
    });

    nodes.push({
      hash: commit.hash,
      parents: commit.parents,
      row,
      lane,
      colorGroup: resolveColorGroup(commit.hash),
      author: commit.author,
      authorEmail: commit.authorEmail,
      authorAvatarUrl: gravatarUrl(commit.authorEmail),
      date: commit.date,
      subject: commit.subject,
      refs: commit.refs,
    });
  });

  return { nodes, edges };
}
