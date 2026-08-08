import type { CommitNode, GraphEdge } from "@minigit2/shared";
import CommitRow from "./CommitRow";

const ROW_HEIGHT = 28;
const LANE_WIDTH = 16;
const NODE_RADIUS = 4;

interface Props {
  nodes: CommitNode[];
  edges: GraphEdge[];
  selectedHash: string | null;
  onSelect: (hash: string) => void;
  onCheckoutCommit: (hash: string) => void;
  onCheckoutBranch: (name: string) => void;
}

export default function GraphView({
  nodes,
  edges,
  selectedHash,
  onSelect,
  onCheckoutCommit,
  onCheckoutBranch,
}: Props) {
  if (nodes.length === 0) {
    return <p className="muted">Aucun commit dans ce repo.</p>;
  }

  const maxLane = nodes.reduce((max, n) => Math.max(max, n.lane), 0);
  const graphWidth = (maxLane + 1) * LANE_WIDTH;
  const svgHeight = nodes.length * ROW_HEIGHT;
  const rowByHash = new Map(nodes.map((n) => [n.hash, n]));

  const laneX = (lane: number) => lane * LANE_WIDTH + LANE_WIDTH / 2;
  const rowY = (row: number) => row * ROW_HEIGHT + ROW_HEIGHT / 2;

  return (
    <div className="graph-view">
      <svg width={graphWidth} height={svgHeight} className="graph-svg">
        {edges.map((edge, i) => {
          const from = rowByHash.get(edge.from);
          const to = rowByHash.get(edge.to);
          if (!from || !to) return null;
          const x1 = laneX(edge.fromLane);
          const y1 = rowY(from.row);
          const x2 = laneX(edge.toLane);
          const y2 = rowY(to.row);
          if (x1 === x2) {
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={from.color} strokeWidth={2} />;
          }
          const midY = (y1 + y2) / 2;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
              stroke={from.color}
              strokeWidth={2}
              fill="none"
            />
          );
        })}
        {nodes.map((node) => (
          <circle
            key={node.hash}
            cx={laneX(node.lane)}
            cy={rowY(node.row)}
            r={NODE_RADIUS}
            fill={node.color}
            stroke={node.hash === selectedHash ? "currentColor" : "none"}
            strokeWidth={node.hash === selectedHash ? 2 : 0}
          />
        ))}
      </svg>
      <div className="graph-rows">
        {nodes.map((node) => (
          <CommitRow
            key={node.hash}
            node={node}
            height={ROW_HEIGHT}
            selected={node.hash === selectedHash}
            onSelect={() => onSelect(node.hash)}
            onCheckoutCommit={() => onCheckoutCommit(node.hash)}
            onCheckoutBranch={onCheckoutBranch}
          />
        ))}
      </div>
    </div>
  );
}
