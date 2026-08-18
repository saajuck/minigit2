import { useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BlameResponse, FileDiffSummary, FileHotspot } from "@minigit2/shared";
import { getPalette, type LaneColor, type Theme } from "../design-system/palette";
import { ChevronRightIcon } from "../design-system/icons";

export interface Query<T> {
  queryKey: unknown[];
  queryFn: (signal: AbortSignal) => Promise<T>;
  /** Content pinned to a fixed commit hash (or a from/to hash pair) never changes once computed
   * — those call sites pass Infinity. Working-tree content (local/uncommitted diffs) can change
   * between views of the same file, so those call sites pass 0 instead. Required rather than
   * defaulted here so every call site states its own assumption explicitly. */
  staleTime: number;
}

interface Props {
  file: FileDiffSummary;
  theme: Theme;
  /** What to show in the header — the full path in list view, just the filename in tree view
   * (directory context is already conveyed by nesting there). Defaults to file.path. */
  displayPath?: string;
  fetchPatch: Query<string>;
  /** Only provided in single-commit diff mode (one concrete ref to blame against) — its presence
   * is what decides whether the Diff/Blame toggle renders at all. */
  fetchBlame?: Query<BlameResponse>;
  /** Already-resolved, not a Query — the parent (FileChangeList) fetches hotspot stats for every
   * file in the diff in one batched request rather than each FileDiff firing its own, so this is
   * just a lookup into that result. undefined while the batch is still loading or this file
   * wasn't part of it (no badge shown either way). */
  hotspot?: FileHotspot;
  onSelectCommit?: (hash: string) => void;
}

const STATUS_META: Record<FileDiffSummary["status"], { letter: string; laneIndex: number }> = {
  added: { letter: "A", laneIndex: 1 },
  modified: { letter: "M", laneIndex: 0 },
  deleted: { letter: "D", laneIndex: 5 },
  renamed: { letter: "R", laneIndex: 2 },
  untracked: { letter: "U", laneIndex: 4 },
};

export default function FileDiff({
  file,
  theme,
  displayPath,
  fetchPatch,
  fetchBlame,
  hotspot,
  onSelectCommit,
}: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"diff" | "blame">("diff");

  const patchQuery = useQuery({
    queryKey: fetchPatch.queryKey,
    queryFn: ({ signal }) => fetchPatch.queryFn(signal),
    enabled: open && view === "diff",
    staleTime: fetchPatch.staleTime,
  });

  const blameQuery = useQuery({
    queryKey: fetchBlame?.queryKey ?? [],
    queryFn: ({ signal }) => fetchBlame!.queryFn(signal),
    enabled: !!fetchBlame && open && view === "blame",
    staleTime: fetchBlame?.staleTime ?? 0,
  });

  const pal = getPalette(theme);
  const meta = STATUS_META[file.status];
  const badgeColor = pal[meta.laneIndex]!;

  function toggle() {
    setOpen((o) => !o);
  }

  function selectView(next: "diff" | "blame") {
    setOpen(true);
    setView(next);
  }

  return (
    <div className="blueprint file-diff">
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      <div className="file-diff-header">
        <button type="button" className="file-diff-header-main" onClick={toggle}>
          <span className="file-diff-badge" style={{ background: badgeColor.bg, color: badgeColor.text }}>
            {meta.letter}
          </span>
          <span className="file-diff-path" title={file.path}>
            {displayPath ?? file.path}
          </span>
          {hotspot && (
            <span
              className="file-diff-hotspot"
              title={`${hotspot.commits} commits · ${hotspot.authors} authors, all time`}
            >
              {hotspot.commits} · {hotspot.authors}
            </span>
          )}
          <span className="file-diff-chevron" style={{ transform: `rotate(${open ? 90 : 0}deg)` }}>
            <ChevronRightIcon />
          </span>
        </button>
        {fetchBlame && (
          <div className="file-diff-view-toggle">
            <button
              type="button"
              className={view === "diff" ? "active" : ""}
              onClick={() => selectView("diff")}
            >
              Diff
            </button>
            <button
              type="button"
              className={view === "blame" ? "active" : ""}
              onClick={() => selectView("blame")}
            >
              Blame
            </button>
          </div>
        )}
      </div>
      {open && view === "diff" && (
        <div className="file-diff-body">
          {patchQuery.isLoading && <p className="muted">Loading…</p>}
          {patchQuery.error && <p className="error">{(patchQuery.error as Error).message}</p>}
          {patchQuery.data !== undefined && (
            <pre className="patch">
              {patchQuery.data.split("\n").map((line, i) => (
                <div key={i} style={lineStyle(line, pal)}>
                  {line}
                </div>
              ))}
            </pre>
          )}
        </div>
      )}
      {open && view === "blame" && (
        <div className="file-diff-body">
          {blameQuery.isLoading && <p className="muted">Loading…</p>}
          {blameQuery.error && <p className="error">{(blameQuery.error as Error).message}</p>}
          {blameQuery.data && (
            <div className="blame-body">
              {blameQuery.data.lines.map((line, i) => {
                const isNewGroup = i === 0 || blameQuery.data.lines[i - 1]!.hash !== line.hash;
                return (
                  <div className="blame-row" key={i}>
                    <div className="blame-gutter">
                      {isNewGroup && (
                        <>
                          <img
                            className="blame-avatar"
                            src={line.authorAvatarUrl}
                            alt=""
                            loading="lazy"
                            title={`${line.author} <${line.authorEmail}>\n${line.summary}\n${new Date(line.date).toLocaleString()}`}
                          />
                          <button
                            type="button"
                            className="blame-hash-link"
                            title={line.summary}
                            onClick={() => onSelectCommit?.(line.hash)}
                          >
                            {line.hash.slice(0, 7)}
                          </button>
                          <span className="blame-author" title={line.author}>
                            {line.author}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="blame-line-number">{line.lineNumber}</div>
                    <div className="blame-content">{line.content}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function lineStyle(line: string, pal: LaneColor[]): CSSProperties {
  if (line.startsWith("@@")) return { color: pal[3]!.text, fontWeight: 600, whiteSpace: "pre" };
  if (line.startsWith("+")) return { background: pal[1]!.bg, color: pal[1]!.text, whiteSpace: "pre" };
  if (line.startsWith("-")) return { background: pal[5]!.bg, color: pal[5]!.text, whiteSpace: "pre" };
  return { color: "var(--color-text)", opacity: 0.75, whiteSpace: "pre" };
}
