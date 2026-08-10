import type { CommitNode, CompareResponse, DiffResponse, LocalDiffResponse } from "@minigit2/shared";
import { api } from "../api/client";
import type { Theme } from "../design-system/palette";
import CopyableText from "./CopyableText";
import FileChangeList from "./FileChangeList";

interface Props {
  repoId: string | null;
  commit: CommitNode | null;
  diff: DiffResponse | null;
  compare: CompareResponse | null;
  localDiff: LocalDiffResponse | null;
  loading: boolean;
  error: string | null;
  theme: Theme;
  onClearCompare: () => void;
  onClearLocalDiff: () => void;
  onSelectCommit: (hash: string) => void;
}

export default function DiffPanel({
  repoId,
  commit,
  diff,
  compare,
  localDiff,
  loading,
  error,
  theme,
  onClearCompare,
  onClearLocalDiff,
  onSelectCommit,
}: Props) {
  if (loading) return <p className="muted">Loading diff…</p>;
  if (error) return <p className="error">{error}</p>;

  if (localDiff && repoId) {
    return (
      <div className="diff-panel">
        <div className="diff-meta">
          <div className="diff-compare-header">
            <span className="diff-subject">Local changes</span>
            <button type="button" className="btn btn-ghost" onClick={onClearLocalDiff}>
              Close
            </button>
          </div>
        </div>
        {localDiff.files.length === 0 ? (
          <p className="muted">No uncommitted changes.</p>
        ) : (
          <FileChangeList
            key="local"
            files={localDiff.files}
            theme={theme}
            fetchPatch={(file) => () => api.getLocalDiffPatch(repoId, file.path).then((r) => r.patch)}
          />
        )}
      </div>
    );
  }

  if (compare && repoId) {
    return (
      <div className="diff-panel">
        <div className="diff-meta">
          <div className="diff-compare-header">
            <span className="diff-subject">
              Comparing <CopyableText value={compare.from} display={compare.from.slice(0, 7)} /> ↔{" "}
              <CopyableText value={compare.to} display={compare.to.slice(0, 7)} />
            </span>
            <button type="button" className="btn btn-ghost" onClick={onClearCompare}>
              Clear
            </button>
          </div>
        </div>
        {compare.files.length === 0 ? (
          <p className="muted">No differences between these two refs.</p>
        ) : (
          <FileChangeList
            key={`${compare.from}:${compare.to}`}
            files={compare.files}
            theme={theme}
            fetchPatch={(file) => () =>
              api.getComparePatch(repoId, compare.from, compare.to, file.path).then((r) => r.patch)}
          />
        )}
      </div>
    );
  }

  if (!diff || !repoId || !commit) {
    return (
      <div className="empty-box empty-box-lg">
        <span className="empty-box-title">Select a commit</span>
        <span>
          Click a row in the graph to see its diff. Double-click a commit or branch to check it out.
          Ctrl/Cmd-click a second commit to compare the two.
        </span>
      </div>
    );
  }

  return (
    <div className="diff-panel">
      <div className="diff-meta">
        <CopyableText className="diff-hash" value={commit.hash} display={commit.hash.slice(0, 7)} />
        <div className="diff-subject">{commit.subject}</div>
        <div className="diff-submeta">
          <img className="commit-avatar" src={commit.authorAvatarUrl} alt="" loading="lazy" />
          {commit.author} · {formatDate(commit.date)} · parents:{" "}
          {commit.parents.length ? commit.parents.map((p) => p.slice(0, 7)).join(", ") : "none (root commit)"}
        </div>
      </div>
      {diff.files.length === 0 ? (
        <p className="muted">No file changes.</p>
      ) : (
        <FileChangeList
          key={diff.hash}
          files={diff.files}
          theme={theme}
          fetchPatch={(file) => () => api.getFilePatch(repoId, diff.hash, file.path).then((r) => r.patch)}
          fetchBlame={(file) => () => api.getFileBlame(repoId, diff.hash, file.path)}
          onSelectCommit={onSelectCommit}
        />
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
