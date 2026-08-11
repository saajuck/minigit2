import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { CommitNode, GraphEdge } from "@minigit2/shared";
import { getPalette, type Theme } from "../design-system/palette";
import CommitRow from "./CommitRow";
import GraphMinimap from "./GraphMinimap";
import ResizableDivider from "./ResizableDivider";

const ROW_HEIGHT = 34;
const LANE_WIDTH = 22;
const PAD_X = 18;
const OVERSCAN_ROWS = 8;
// How many lanes the default lane-strip width corresponds to — the strip itself is
// user-resizable (see App.tsx's graphLaneWidth), this only seeds its initial value.
const DEFAULT_VISIBLE_LANES = 5;
export const DEFAULT_LANE_WIDTH = PAD_X + DEFAULT_VISIBLE_LANES * LANE_WIDTH;

interface Props {
  nodes: CommitNode[];
  edges: GraphEdge[];
  selectedHash: string | null;
  compareHash: string | null;
  /** Non-null while a search is active: hashes matching the query. Rows outside this set are dimmed. */
  matchHashes: Set<string> | null;
  theme: Theme;
  /** Width of the lane area, in px — user-resizable via the divider, not derived from the graph's own lane count. */
  laneWidth: number;
  onLaneResize: (deltaX: number) => void;
  onSelect: (hash: string) => void;
  onCompareClick: (hash: string) => void;
  onCheckoutRef: (ref: string) => void;
}

export default function GraphView({
  nodes,
  edges,
  selectedHash,
  compareHash,
  matchHashes,
  theme,
  laneWidth,
  onLaneResize,
  onSelect,
  onCompareClick,
  onCheckoutRef,
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

  // Keep the selected row in view regardless of what selected it (click, arrow keys, or
  // jumping to a search match) — a single place responsible for "scroll it into view".
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !selectedHash) return;
    const node = nodes.find((n) => n.hash === selectedHash);
    if (!node) return;
    const top = node.row * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    if (top < el.scrollTop) {
      el.scrollTop = top;
    } else if (bottom > el.scrollTop + el.clientHeight) {
      el.scrollTop = bottom - el.clientHeight;
    }
  }, [selectedHash, nodes]);

  if (nodes.length === 0) {
    return (
      <div className="empty-box empty-box-lg">
        <span className="empty-box-title">No commits yet</span>
        <span>This branch hasn&rsquo;t been born — make a first commit to see it here.</span>
      </div>
    );
  }

  const pal = getPalette(theme);
  // Colored by colorGroup (a persistent per-branch-run id from the server), not by the row's
  // current lane — a lane number can legitimately shift around a merge, but colorGroup stays
  // fixed for the whole continuous run, so a single branch never changes color partway through.
  const currentBranchColorGroup =
    nodes.find((n) => n.refs.some((r) => r.type === "branch" && r.isHead))?.colorGroup ?? null;
  const groupColor = (colorGroup: number) =>
    colorGroup === currentBranchColorGroup ? pal[colorGroup % pal.length]!.strong : pal[colorGroup % pal.length]!.stroke;

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
    // Interval overlap, not "either endpoint is inside" — an edge spanning a wide row range
    // (e.g. a branch merged back long after it forked) must still be drawn while scrolled to
    // a point between its two endpoints, even though neither endpoint itself is on screen.
    const minRow = Math.min(from.row, to.row);
    const maxRow = Math.max(from.row, to.row);
    return minRow <= lastRow && maxRow >= firstRow;
  });

  const laneX = (lane: number) => PAD_X + lane * LANE_WIDTH;
  const rowY = (row: number) => ROW_HEIGHT / 2 + row * ROW_HEIGHT;

  function isDimmed(hash: string): boolean {
    return matchHashes !== null && !matchHashes.has(hash);
  }

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
    <div className="graph-view-wrapper">
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
        <div
          className={`graph-svg-viewport${graphWidth > laneWidth ? " graph-svg-viewport-overflowing" : ""}`}
          style={{ width: laneWidth }}
        >
          <svg width={graphWidth} height={totalHeight} className="graph-svg">
            {visibleEdges.map((edge) => {
              const from = rowByHash.get(edge.from);
              const to = rowByHash.get(edge.to);
              if (!from || !to) return null;
              const x1 = laneX(edge.fromLane);
              const y1 = rowY(from.row);
              const x2 = laneX(edge.toLane);
              const y2 = rowY(to.row);
              const color = groupColor(edge.colorGroup);
              const strokeWidth = edge.colorGroup === currentBranchColorGroup ? 3 : 2;
              const key = `${edge.from}:${edge.to}`;
              if (x1 === x2) {
                return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={strokeWidth} />;
              }
              // Confine the lane change to a single row height right after the child, then run
              // straight down the target lane for the rest — not a bend stretched across the
              // whole span. layoutGraph frees a commit's lane for reuse by an unrelated branch
              // starting at the very next row, so a curve that keeps hugging the old lane for
              // longer than that (as a symmetric midpoint bend does on a multi-row edge) visually
              // overlaps whatever unrelated commits land in that freed lane.
              const bendY = y1 + Math.sign(y2 - y1) * Math.min(ROW_HEIGHT, Math.abs(y2 - y1));
              const midY = (y1 + bendY) / 2;
              return (
                <path
                  key={key}
                  d={`M${x1} ${y1} C${x1} ${midY} ${x2} ${midY} ${x2} ${bendY} L${x2} ${y2}`}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  fill="none"
                />
              );
            })}
            {visibleNodes.map((node) => {
              const isHead = node.refs.some((r) => r.isHead);
              const selected = node.hash === selectedHash;
              const compared = node.hash === compareHash;
              const dimmed = isDimmed(node.hash);
              const color = groupColor(node.colorGroup);
              return (
                <circle
                  key={node.hash}
                  cx={laneX(node.lane)}
                  cy={rowY(node.row)}
                  r={selected || compared ? 7 : 5.5}
                  fill={isHead ? color : "var(--color-bg)"}
                  stroke={color}
                  strokeWidth={selected || compared ? 3 : 2}
                  strokeDasharray={compared ? "3 2" : undefined}
                  opacity={dimmed ? 0.25 : 1}
                />
              );
            })}
          </svg>
        </div>
        <ResizableDivider onResize={onLaneResize} className="graph-lane-divider" />
        <div className="graph-rows" style={{ height: totalHeight }}>
          {visibleNodes.map((node) => (
            <div key={node.hash} className="graph-row-positioner" style={{ top: node.row * ROW_HEIGHT }}>
              <CommitRow
                node={node}
                height={ROW_HEIGHT}
                theme={theme}
                selected={node.hash === selectedHash}
                compared={node.hash === compareHash}
                dimmed={isDimmed(node.hash)}
                onSelect={() => onSelect(node.hash)}
                onCompareClick={() => onCompareClick(node.hash)}
                onCheckoutRef={onCheckoutRef}
              />
            </div>
          ))}
        </div>
      </div>
      <GraphMinimap
        nodes={nodes}
        theme={theme}
        scrollTop={scrollTop}
        viewportHeight={viewportHeight}
        totalHeight={totalHeight}
        rowHeight={ROW_HEIGHT}
        matchHashes={matchHashes}
        onScrollTo={(top) => {
          if (containerRef.current) containerRef.current.scrollTop = top;
        }}
      />
    </div>
  );
}
