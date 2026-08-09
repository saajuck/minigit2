import { useState, type CSSProperties } from "react";
import type { FileDiffSummary } from "@minigit2/shared";
import { api } from "../api/client";
import { getPalette, type LaneColor, type Theme } from "../design-system/palette";
import { ChevronRightIcon } from "../design-system/icons";
import CopyableText from "./CopyableText";

interface Props {
  repoId: string;
  hash: string;
  file: FileDiffSummary;
  theme: Theme;
}

const STATUS_META: Record<FileDiffSummary["status"], { letter: string; laneIndex: number }> = {
  added: { letter: "A", laneIndex: 1 },
  modified: { letter: "M", laneIndex: 0 },
  deleted: { letter: "D", laneIndex: 5 },
  renamed: { letter: "R", laneIndex: 2 },
};

export default function FileDiff({ repoId, hash, file, theme }: Props) {
  const [open, setOpen] = useState(false);
  const [patch, setPatch] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pal = getPalette(theme);
  const meta = STATUS_META[file.status];
  const badgeColor = pal[meta.laneIndex]!;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && patch === null && !loading) {
      setLoading(true);
      setError(null);
      api
        .getFilePatch(repoId, hash, file.path)
        .then((data) => setPatch(data.patch))
        .catch((err) => setError((err as Error).message))
        .finally(() => setLoading(false));
    }
  }

  return (
    <div className="blueprint file-diff">
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      <button type="button" className="file-diff-header" onClick={toggle}>
        <span className="file-diff-badge" style={{ background: badgeColor.bg, color: badgeColor.text }}>
          {meta.letter}
        </span>
        <CopyableText className="file-diff-path" value={file.path} />
        <span className="file-diff-chevron" style={{ transform: `rotate(${open ? 90 : 0}deg)` }}>
          <ChevronRightIcon />
        </span>
      </button>
      {open && (
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
    </div>
  );
}

function lineStyle(line: string, pal: LaneColor[]): CSSProperties {
  if (line.startsWith("@@")) return { color: pal[3]!.text, fontWeight: 600, whiteSpace: "pre" };
  if (line.startsWith("+")) return { background: pal[1]!.bg, color: pal[1]!.text, whiteSpace: "pre" };
  if (line.startsWith("-")) return { background: pal[5]!.bg, color: pal[5]!.text, whiteSpace: "pre" };
  return { color: "var(--color-text)", opacity: 0.75, whiteSpace: "pre" };
}
