import { useState, type FormEvent } from "react";
import Dialog from "./Dialog";
import RepoPathBrowser from "./RepoPathBrowser";

interface Props {
  onAdd: (path: string) => Promise<void>;
  onClose: () => void;
}

export default function AddRepoDialog({ onAdd, onClose }: Props) {
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [browsing, setBrowsing] = useState(false);

  async function submitPath(target: string) {
    setSubmitting(true);
    setError(null);
    try {
      await onAdd(target);
      onClose();
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
      <Dialog title="Add repository" onClose={onClose}>
        <form onSubmit={handleSubmit}>
          <div className="dialog-body">
            <div className="field">
              <label htmlFor="repo-path">Local path</label>
              <input
                id="repo-path"
                className="input"
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/home/alice/code/my-project"
                disabled={submitting}
                autoFocus
              />
            </div>
            {error && <p className="error">{error}</p>}
          </div>
          <div className="dialog-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setBrowsing(true)}
              disabled={submitting}
            >
              Browse…
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !path.trim()}>
              Add repository
            </button>
          </div>
        </form>
      </Dialog>
      {browsing && <RepoPathBrowser onChoose={handleChoose} onClose={() => setBrowsing(false)} />}
    </>
  );
}
