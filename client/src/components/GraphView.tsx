import { useEffect, useRef, useState } from "react";
import type { CommitNode, GraphEdge } from "@minigit2/shared";
import CommitRow from "./CommitRow";

const ROW_HEIGHT = 28;
const LANE_WIDTH = 16;
const NODE_RADIUS = 4;
const OVERSCAN_ROWS = 8;

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setViewportHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (nodes.length === 0) {
    return <p className="muted">Aucun commit dans ce repo.</p>;
  }

  const maxLane = nodes.reduce((max, n) => Math.max(max, n.lane), 0);
  const graphWidth = (maxLane + 1) * LANE_WIDTH;
  const totalHeight = nodes.length * ROW_HEIGHT;
  const rowByHash = new Map(nodes.map((n) => [n.hash, n]));

  // Only mount rows (and SVG shapes) near the visible scroll range — the rest of the
  // list can be thousands of commits deep, and mounting every row up front is what
  // makes large histories feel sluggish.
  const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS);
  const lastRow = Math.min(
    nodes.length - 1,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN_ROWS,
  );
  const visibleNodes = nodes.slice(firstRow, lastRow + 1);
  const visibleEdges = edges.filter((edge) => {
    const from = rowByHash.get(edge.from);
    const to = rowByHash.get(edge.to);
    if (!from || !to) return false;
    return (from.row >= firstRow && from.row <= lastRow) || (to.row >= firstRow && to.row <= lastRow);
  });

  const laneX = (lane: number) => lane * LANE_WIDTH + LANE_WIDTH / 2;
  const rowY = (row: number) => row * ROW_HEIGHT + ROW_HEIGHT / 2;

  return (
    <div className="graph-view" ref={containerRef} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
      <svg width={graphWidth} height={totalHeight} className="graph-svg">
        {visibleEdges.map((edge) => {
          const from = rowByHash.get(edge.from);
          const to = rowByHash.get(edge.to);
          if (!from || !to) return null;
          const x1 = laneX(edge.fromLane);
          const y1 = rowY(from.row);
          const x2 = laneX(edge.toLane);
          const y2 = rowY(to.row);
          const key = `${edge.from}:${edge.to}`;
          if (x1 === x2) {
            return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={from.color} strokeWidth={2} />;
          }
          const midY = (y1 + y2) / 2;
          return (
            <path
              key={key}
              d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
              stroke={from.color}
              strokeWidth={2}
              fill="none"
            />
          );
        })}
        {visibleNodes.map((node) => (
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
      <div className="graph-rows" style={{ height: totalHeight }}>
        {visibleNodes.map((node) => (
          <div key={node.hash} className="graph-row-positioner" style={{ top: node.row * ROW_HEIGHT }}>
            <CommitRow
              node={node}
              height={ROW_HEIGHT}
              selected={node.hash === selectedHash}
              onSelect={() => onSelect(node.hash)}
              onCheckoutCommit={() => onCheckoutCommit(node.hash)}
              onCheckoutBranch={onCheckoutBranch}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
