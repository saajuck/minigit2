import type { CommitNode, GraphEdge } from "@minigit2/shared";
import type { RawCommit } from "../git/log";

const PALETTE = [
  "#4f8fea",
  "#e6a23c",
  "#67c23a",
  "#f56c6c",
  "#9b59b6",
  "#1abc9c",
  "#e67e22",
  "#3498db",
  "#e74c3c",
  "#2ecc71",
];

export interface GraphLayout {
  nodes: CommitNode[];
  edges: GraphEdge[];
}

/**
 * Assigns each commit a row (topo order, already given) and a lane (column), greedily
 * reusing the leftmost free lane. A parent already reserved by an earlier child (fork
 * point, or a merge's non-mainline parent) keeps its reserved lane rather than being
 * reassigned by whichever commit reaches it next.
 */
export function layoutGraph(commits: RawCommit[]): GraphLayout {
  const lanes: (string | null)[] = [];
  const laneOf = new Map<string, number>();
  const nodes: CommitNode[] = [];
  const edges: GraphEdge[] = [];

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
      edges.push({ from: commit.hash, to: parentHash, fromLane: lane, toLane: parentLane });
    });

    nodes.push({
      hash: commit.hash,
      parents: commit.parents,
      row,
      lane,
      color: PALETTE[lane % PALETTE.length] as string,
      author: commit.author,
      authorEmail: commit.authorEmail,
      date: commit.date,
      subject: commit.subject,
      refs: commit.refs,
    });
  });

  return { nodes, edges };
}
