import type { RepoSummary } from "@minigit2/shared";
import { TrashIcon } from "../design-system/icons";
import { getPalette, type Theme } from "../design-system/palette";

interface Props {
  repos: RepoSummary[];
  activeRepoId: string | null;
  theme: Theme;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function RepoSwitcher({ repos, activeRepoId, theme, onSelect, onRemove }: Props) {
  if (repos.length === 0) {
    return (
      <div className="empty-box">
        <span>No repositories added yet.</span>
        <span className="empty-box-sub">Add a local repo path to browse its history.</span>
      </div>
    );
  }

  const laneColor = getPalette(theme)[0]!;

  return (
    <div className="repo-cards">
      {repos.map((repo) => {
        const active = repo.id === activeRepoId;
        const branchLabel = repo.detached ? `detached @ ${repo.branch ?? "?"}` : (repo.branch ?? "no commits");
        return (
          <div
            key={repo.id}
            className={`blueprint repo-card${active ? " active" : ""}`}
            onClick={() => onSelect(repo.id)}
          >
            <i className="corner tl" />
            <i className="corner tr" />
            <i className="corner bl" />
            <i className="corner br" />
            <div className="repo-card-row">
              <div className="repo-card-main">
                <div className="repo-card-name">{repo.name}</div>
                <div className="repo-card-path">{repo.path}</div>
                <div className="repo-card-meta">
                  <span className="tag repo-branch-tag" style={{ background: laneColor.bg, color: laneColor.text }}>
                    {branchLabel}
                  </span>
                  {repo.dirty && <span className="dirty-dot" />}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon repo-remove"
                title="Remove this repo from the list"
                aria-label={`Remove ${repo.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(repo.id);
                }}
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
