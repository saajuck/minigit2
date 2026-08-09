import type { CommitNode, DiffResponse } from "@minigit2/shared";
import type { Theme } from "../design-system/palette";
import FileDiff from "./FileDiff";

interface Props {
  repoId: string | null;
  commit: CommitNode | null;
  diff: DiffResponse | null;
  loading: boolean;
  error: string | null;
  theme: Theme;
}

export default function DiffPanel({ repoId, commit, diff, loading, error, theme }: Props) {
  if (loading) return <p className="muted">Loading diff…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!diff || !repoId || !commit) {
    return (
      <div className="empty-box empty-box-lg">
        <span className="empty-box-title">Select a commit</span>
        <span>Click a row in the graph to see its diff. Double-click a commit or branch to check it out.</span>
      </div>
    );
  }

  return (
    <div className="diff-panel">
      <div className="diff-meta">
        <div className="diff-hash">{commit.hash.slice(0, 7)}</div>
        <div className="diff-subject">{commit.subject}</div>
        <div className="diff-submeta">
          {commit.author} · {formatDate(commit.date)} · parents:{" "}
          {commit.parents.length ? commit.parents.map((p) => p.slice(0, 7)).join(", ") : "none (root commit)"}
        </div>
      </div>
      {diff.files.length === 0 ? (
        <p className="muted">No file changes.</p>
      ) : (
        <div className="diff-files">
          {diff.files.map((file) => (
            <FileDiff
              key={`${diff.hash}:${file.oldPath ?? file.path}`}
              repoId={repoId}
              hash={diff.hash}
              file={file}
              theme={theme}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
