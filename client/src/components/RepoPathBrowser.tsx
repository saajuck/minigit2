import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Props {
  onChoose: (path: string) => void;
  onClose: () => void;
}

export default function RepoPathBrowser({ onChoose, onClose }: Props) {
  const [current, setCurrent] = useState<string | null>(null);
  const [parent, setParent] = useState<string | null>(null);
  const [directories, setDirectories] = useState<{ name: string; path: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load(path?: string) {
    setError(null);
    api
      .browseFs(path)
      .then((data) => {
        setCurrent(data.path);
        setParent(data.parent);
        setDirectories(data.directories);
      })
      .catch((err) => setError((err as Error).message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal browser-modal" onClick={(e) => e.stopPropagation()}>
        <p className="browser-path">{current ?? "…"}</p>
        {error && <p className="error">{error}</p>}
        <ul className="browser-list">
          {parent !== null && (
            <li>
              <button type="button" onClick={() => load(parent)}>
                .. (parent folder)
              </button>
            </li>
          )}
          {directories.map((dir) => (
            <li key={dir.path}>
              <button type="button" onClick={() => load(dir.path)}>
                {dir.name}
              </button>
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" disabled={!current} onClick={() => current && onChoose(current)}>
            Choose this folder
          </button>
        </div>
      </div>
    </div>
  );
}
