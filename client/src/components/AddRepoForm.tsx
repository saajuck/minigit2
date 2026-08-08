import { useState, type FormEvent } from "react";

interface Props {
  onAdd: (path: string) => Promise<void>;
}

export default function AddRepoForm({ onAdd }: Props) {
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!path.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onAdd(path.trim());
      setPath("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="add-repo-form">
      <input
        type="text"
        value={path}
        onChange={(e) => setPath(e.target.value)}
        placeholder="/chemin/absolu/vers/un/repo"
        disabled={submitting}
      />
      <button type="submit" disabled={submitting}>
        Ajouter
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
