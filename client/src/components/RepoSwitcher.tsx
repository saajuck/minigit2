import type { RepoInfo } from "@minigit2/shared";

interface Props {
  repos: RepoInfo[];
  activeRepoId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function RepoSwitcher({ repos, activeRepoId, onSelect, onRemove }: Props) {
  if (repos.length === 0) {
    return <p className="muted">Aucun repo ajouté pour l&rsquo;instant.</p>;
  }

  return (
    <ul className="repo-switcher">
      {repos.map((repo) => (
        <li key={repo.id} className={repo.id === activeRepoId ? "active" : ""}>
          <button type="button" onClick={() => onSelect(repo.id)} title={repo.path}>
            {repo.name}
          </button>
          <button
            type="button"
            className="remove"
            onClick={() => onRemove(repo.id)}
            aria-label={`Retirer ${repo.name}`}
            title="Retirer ce repo de la liste"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
