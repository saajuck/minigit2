import { useRef, type MouseEvent as ReactMouseEvent } from "react";
import type { CommitNode } from "@minigit2/shared";
import { getPalette, type Theme } from "../design-system/palette";

interface Props {
  nodes: CommitNode[];
  theme: Theme;
  scrollTop: number;
  viewportHeight: number;
  totalHeight: number;
  rowHeight: number;
  /** Non-null while a search is active — matching rows get their own tick, in a different
   * color from tags so both stay legible on a commit that happens to be both. */
  matchHashes: Set<string> | null;
  onScrollTo: (top: number) => void;
}

/** A compact overview strip alongside the graph, one per pane rather than one per commit — the
 * whole history compresses into whatever height the pane actually has (the same viewportHeight
 * GraphView already tracks for its own scroll math, since this sits as a flex-stretched sibling
 * of equal height, so no separate size tracking is needed here). Tags get a highlighted tick
 * since they're what you're usually hunting for in a long history; branch tips aren't marked —
 * there are normally too many of them for individual ticks to stay legible at this scale, and
 * the commit search box already finds a specific branch's tip on request. Search matches get
 * their own tick too, in a different column (left vs right half of the strip) so a commit that's
 * both tagged and matching still shows both. */
export default function GraphMinimap({
  nodes,
  theme,
  scrollTop,
  viewportHeight,
  totalHeight,
  rowHeight,
  matchHashes,
  onScrollTo,
}: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  if (totalHeight <= 0 || viewportHeight <= 0) return <div className="graph-minimap" ref={elRef} />;

  const scale = viewportHeight / totalHeight;
  const pal = getPalette(theme);
  const tagColor = pal[2]!.stroke;
  const matchColor = pal[3]!.stroke;

  function scrollToClientY(clientY: number) {
    const el = elRef.current;
    if (!el) return;
    const y = clientY - el.getBoundingClientRect().top;
    // Center the viewport on the pointer rather than snapping its top edge there — clicking
    // near a tag tick should bring that tick toward the middle of the real view, not its edge.
    const target = y / scale - viewportHeight / 2;
    onScrollTo(Math.max(0, Math.min(totalHeight - viewportHeight, target)));
  }

  function handleMouseMove(e: globalThis.MouseEvent) {
    if (!draggingRef.current) return;
    scrollToClientY(e.clientY);
  }

  function handleMouseUp() {
    draggingRef.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }

  function handleMouseDown(e: ReactMouseEvent) {
    draggingRef.current = true;
    scrollToClientY(e.clientY);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    e.preventDefault();
  }

  return (
    <div className="graph-minimap" ref={elRef} onMouseDown={handleMouseDown} title="Drag to navigate the graph">
      {matchHashes &&
        nodes
          .filter((n) => matchHashes.has(n.hash))
          .map((n) => (
            <div
              key={n.hash}
              className="graph-minimap-match"
              style={{ top: n.row * rowHeight * scale, background: matchColor }}
            />
          ))}
      {nodes
        .filter((n) => n.refs.some((r) => r.type === "tag"))
        .map((n) => {
          const tagName = n.refs.find((r) => r.type === "tag")!.name;
          return (
            <div
              key={n.hash}
              className="graph-minimap-tag"
              style={{ top: n.row * rowHeight * scale, background: tagColor }}
              title={tagName}
            />
          );
        })}
      <div
        className="graph-minimap-viewport"
        style={{ top: scrollTop * scale, height: Math.max(4, viewportHeight * scale) }}
      />
    </div>
  );
}
