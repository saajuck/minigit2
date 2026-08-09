import type { StatusResponse } from "@minigit2/shared";
import { getPalette, type Theme } from "../design-system/palette";

interface Props {
  status: StatusResponse | null;
  theme: Theme;
}

export default function StatusChips({ status, theme }: Props) {
  if (!status) return null;

  const steel = getPalette(theme)[0]!;
  const branchLabel = status.detached
    ? `detached @ ${status.headCommit?.slice(0, 7) ?? "?"}`
    : (status.branch ?? "(no commits yet)");
  const branchStyle = status.detached
    ? { fontFamily: "var(--font-mono)" }
    : { background: steel.bg, color: steel.text, fontWeight: 600 };

  return (
    <div className="status-chips">
      <span className={`tag${status.detached ? " tag-neutral" : ""}`} style={branchStyle}>
        {branchLabel}
      </span>
      <span className={`tag ${status.dirty ? "tag-dirty" : "tag-neutral"}`}>{status.dirty ? "dirty" : "clean"}</span>
      {status.staged > 0 && <span className="tag tag-neutral">{status.staged} staged</span>}
      {status.unstaged > 0 && <span className="tag tag-neutral">{status.unstaged} unstaged</span>}
      {status.untracked > 0 && <span className="tag tag-neutral">{status.untracked} untracked</span>}
      {status.aheadBehind && (status.aheadBehind.ahead > 0 || status.aheadBehind.behind > 0) && (
        <span className="tag tag-neutral" title="Commits ahead/behind the tracked upstream branch">
          {status.aheadBehind.ahead > 0 && `↑${status.aheadBehind.ahead}`}
          {status.aheadBehind.ahead > 0 && status.aheadBehind.behind > 0 && " "}
          {status.aheadBehind.behind > 0 && `↓${status.aheadBehind.behind}`}
        </span>
      )}
    </div>
  );
}
