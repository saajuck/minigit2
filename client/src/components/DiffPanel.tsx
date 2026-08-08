import type { DiffResponse } from "@minigit2/shared";
import FileDiff from "./FileDiff";

interface Props {
  repoId: string | null;
  diff: DiffResponse | null;
  loading: boolean;
  error: string | null;
}

export default function DiffPanel({ repoId, diff, loading, error }: Props) {
  if (loading) return <p className="muted">Chargement du diff…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!diff || !repoId) return <p className="muted">Sélectionne un commit pour voir son diff.</p>;
  if (diff.files.length === 0) return <p className="muted">Aucun changement de fichier.</p>;

  return (
    <div className="diff-panel">
      <h2>{diff.hash.slice(0, 7)}</h2>
      {diff.files.map((file) => (
        <FileDiff key={`${diff.hash}:${file.oldPath ?? file.path}`} repoId={repoId} hash={diff.hash} file={file} />
      ))}
    </div>
  );
}
