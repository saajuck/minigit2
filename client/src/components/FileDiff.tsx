import { useState, type CSSProperties } from "react";
import type { BlameResponse, FileDiffSummary } from "@minigit2/shared";
import { getPalette, type LaneColor, type Theme } from "../design-system/palette";
import { ChevronRightIcon } from "../design-system/icons";
import CopyableText from "./CopyableText";

interface Props {
  file: FileDiffSummary;
  theme: Theme;
  fetchPatch: () => Promise<string>;
  /** Only provided in single-commit diff mode (one concrete ref to blame against) — its presence
   * is what decides whether the Diff/Blame toggle renders at all. */
  fetchBlame?: () => Promise<BlameResponse>;
  onSelectCommit?: (hash: string) => void;
}

const STATUS_META: Record<FileDiffSummary["status"], { letter: string; laneIndex: number }> = {
  added: { letter: "A", laneIndex: 1 },
  modified: { letter: "M", laneIndex: 0 },
  deleted: { letter: "D", laneIndex: 5 },
  renamed: { letter: "R", laneIndex: 2 },
  untracked: { letter: "U", laneIndex: 4 },
};

export default function FileDiff({ file, theme, fetchPatch, fetchBlame, onSelectCommit }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"diff" | "blame">("diff");
  const [patch, setPatch] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blame, setBlame] = useState<BlameResponse | null>(null);
  const [blameLoading, setBlameLoading] = useState(false);
  const [blameError, setBlameError] = useState<string | null>(null);

  const pal = getPalette(theme);
  const meta = STATUS_META[file.status];
  const badgeColor = pal[meta.laneIndex]!;

  function ensurePatchLoaded() {
    if (patch !== null || loading) return;
    setLoading(true);
    setError(null);
    fetchPatch()
      .then((text) => setPatch(text))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }

  function ensureBlameLoaded() {
    if (!fetchBlame || blame !== null || blameLoading) return;
    setBlameLoading(true);
    setBlameError(null);
    fetchBlame()
      .then((data) => setBlame(data))
      .catch((err) => setBlameError((err as Error).message))
      .finally(() => setBlameLoading(false));
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      if (view === "diff") ensurePatchLoaded();
      else ensureBlameLoaded();
    }
  }

  function selectView(next: "diff" | "blame") {
    setOpen(true);
    setView(next);
    if (next === "diff") ensurePatchLoaded();
    else ensureBlameLoaded();
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
          <CopyableText className="file-diff-path" value={file.path} stopPropagation={false} />
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
          {loading && <p className="muted">Loading…</p>}
          {error && <p className="error">{error}</p>}
          {patch !== null && (
            <pre className="patch">
              {patch.split("\n").map((line, i) => (
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
          {blameLoading && <p className="muted">Loading…</p>}
          {blameError && <p className="error">{blameError}</p>}
          {blame !== null && (
            <div className="blame-body">
              {blame.lines.map((line, i) => {
                const isNewGroup = i === 0 || blame.lines[i - 1]!.hash !== line.hash;
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
