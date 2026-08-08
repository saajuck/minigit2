import { useState, type FormEvent } from "react";
import RepoPathBrowser from "./RepoPathBrowser";

interface Props {
  onAdd: (path: string) => Promise<void>;
}

export default function AddRepoForm({ onAdd }: Props) {
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [browsing, setBrowsing] = useState(false);

  async function submitPath(target: string) {
    setSubmitting(true);
    setError(null);
    try {
      await onAdd(target);
      setPath("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!path.trim()) return;
    submitPath(path.trim());
  }

  function handleChoose(chosenPath: string) {
    setBrowsing(false);
    submitPath(chosenPath);
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="add-repo-form">
        <input
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="/chemin/absolu/vers/un/repo"
          disabled={submitting}
        />
        <div className="add-repo-actions">
          <button type="submit" disabled={submitting}>
            Ajouter
          </button>
          <button type="button" onClick={() => setBrowsing(true)} disabled={submitting}>
            Parcourir…
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </form>
      {browsing && <RepoPathBrowser onChoose={handleChoose} onClose={() => setBrowsing(false)} />}
    </>
  );
}
