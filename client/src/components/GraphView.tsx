import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { CommitNode, GraphEdge } from "@minigit2/shared";
import { getPalette, type Theme } from "../design-system/palette";
import CommitRow from "./CommitRow";

const ROW_HEIGHT = 34;
const LANE_WIDTH = 22;
const PAD_X = 18;
const OVERSCAN_ROWS = 8;

interface Props {
  nodes: CommitNode[];
  edges: GraphEdge[];
  selectedHash: string | null;
  theme: Theme;
  onSelect: (hash: string) => void;
  onCheckoutRef: (ref: string) => void;
}

export default function GraphView({ nodes, edges, selectedHash, theme, onSelect, onCheckoutRef }: Props) {
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
    return (
      <div className="empty-box empty-box-lg">
        <span className="empty-box-title">No commits yet</span>
        <span>This branch hasn&rsquo;t been born — make a first commit to see it here.</span>
      </div>
    );
  }

  const pal = getPalette(theme);
  const laneColor = (lane: number) => pal[lane % pal.length]!.stroke;

  const maxLane = nodes.reduce((max, n) => Math.max(max, n.lane), 0);
  const graphWidth = PAD_X + (maxLane + 1) * LANE_WIDTH;
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

  const laneX = (lane: number) => PAD_X + lane * LANE_WIDTH;
  const rowY = (row: number) => ROW_HEIGHT / 2 + row * ROW_HEIGHT;

  function ensureRowVisible(row: number) {
    const el = containerRef.current;
    if (!el) return;
    const top = row * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    if (top < el.scrollTop) {
      el.scrollTop = top;
    } else if (bottom > el.scrollTop + el.clientHeight) {
      el.scrollTop = bottom - el.clientHeight;
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const currentIndex = selectedHash ? nodes.findIndex((n) => n.hash === selectedHash) : -1;
      const nextIndex =
        e.key === "ArrowDown" ? Math.min(nodes.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
      const nextNode = nodes[nextIndex];
      if (nextNode) {
        onSelect(nextNode.hash);
        ensureRowVisible(nextIndex);
      }
    } else if (e.key === "Enter" && selectedHash) {
      onCheckoutRef(selectedHash);
    }
  }

  return (
    <div
      className="blueprint graph-view"
      ref={containerRef}
      tabIndex={0}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      onKeyDown={handleKeyDown}
    >
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      <svg width={graphWidth} height={totalHeight} className="graph-svg">
        {visibleEdges.map((edge) => {
          const from = rowByHash.get(edge.from);
          const to = rowByHash.get(edge.to);
          if (!from || !to) return null;
          const x1 = laneX(edge.fromLane);
          const y1 = rowY(from.row);
          const x2 = laneX(edge.toLane);
          const y2 = rowY(to.row);
          const color = laneColor(from.lane);
          const key = `${edge.from}:${edge.to}`;
          if (x1 === x2) {
            return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} />;
          }
          const midY = (y1 + y2) / 2;
          return (
            <path
              key={key}
              d={`M${x1} ${y1} C${x1} ${midY} ${x2} ${midY} ${x2} ${y2}`}
              stroke={color}
              strokeWidth={2}
              fill="none"
            />
          );
        })}
        {visibleNodes.map((node) => {
          const isHead = node.refs.some((r) => r.isHead);
          const selected = node.hash === selectedHash;
          const color = laneColor(node.lane);
          return (
            <circle
              key={node.hash}
              cx={laneX(node.lane)}
              cy={rowY(node.row)}
              r={selected ? 7 : 5.5}
              fill={isHead ? color : "var(--color-bg)"}
              stroke={color}
              strokeWidth={selected ? 3 : 2}
            />
          );
        })}
      </svg>
      <div className="graph-rows" style={{ height: totalHeight }}>
        {visibleNodes.map((node) => (
          <div key={node.hash} className="graph-row-positioner" style={{ top: node.row * ROW_HEIGHT }}>
            <CommitRow
              node={node}
              height={ROW_HEIGHT}
              theme={theme}
              selected={node.hash === selectedHash}
              onSelect={() => onSelect(node.hash)}
              onCheckoutRef={onCheckoutRef}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
