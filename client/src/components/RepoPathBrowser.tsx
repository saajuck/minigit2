import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

interface Props {
  onChoose: (path: string) => void;
  onClose: () => void;
}

export default function RepoPathBrowser({ onChoose, onClose }: Props) {
  const [path, setPath] = useState<string | undefined>(undefined);

  const browseQuery = useQuery({
    queryKey: ["browseFs", path],
    queryFn: ({ signal }) => api.browseFs(path, signal),
  });
  const current = browseQuery.data?.path ?? null;
  const parent = browseQuery.data?.parent ?? null;
  const directories = browseQuery.data?.directories ?? [];
  const error = browseQuery.error as Error | null;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog browser-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">Choose a folder</div>
        <p className="browser-path">{current ?? "…"}</p>
        {error && <p className="error">{error.message}</p>}
        <ul className="browser-list">
          {parent !== null && (
            <li>
              <button type="button" onClick={() => setPath(parent)}>
                .. (parent folder)
              </button>
            </li>
          )}
          {directories.map((dir) => (
            <li key={dir.path}>
              <button type="button" onClick={() => setPath(dir.path)}>
                {dir.name}
              </button>
            </li>
          ))}
        </ul>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!current}
            onClick={() => current && onChoose(current)}
          >
            Choose this folder
          </button>
        </div>
      </div>
    </div>
  );
}
