import { useEffect, useState } from "react";
import type { DiffResponse, StashEntry } from "@minigit2/shared";
import { api } from "../api/client";
import type { Theme } from "../design-system/palette";
import { ChevronRightIcon } from "../design-system/icons";
import CopyableText from "./CopyableText";
import FileDiff from "./FileDiff";

interface Props {
  repoId: string;
  theme: Theme;
  onClose: () => void;
}

export default function StashDialog({ repoId, theme, onClose }: Props) {
  const [entries, setEntries] = useState<StashEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getStashList(repoId)
      .then((data) => setEntries(data.entries))
      .catch((err) => setError((err as Error).message));
  }, [repoId]);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog browser-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">Stash</div>
        {error && <p className="error">{error}</p>}
        {!error && entries === null && <p className="muted">Loading…</p>}
        {!error && entries !== null && entries.length === 0 && <p className="muted">No stash entries.</p>}
        {!error && entries !== null && entries.length > 0 && (
          <ul className="entry-list">
            {entries.map((entry) => (
              <StashRow key={entry.ref} repoId={repoId} entry={entry} theme={theme} />
            ))}
          </ul>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function StashRow({ repoId, entry, theme }: { repoId: string; entry: StashEntry; theme: Theme }) {
  const [open, setOpen] = useState(false);
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && diff === null && !loading) {
      setLoading(true);
      setError(null);
      api
        .getDiff(repoId, entry.hash)
        .then((data) => setDiff(data))
        .catch((err) => setError((err as Error).message))
        .finally(() => setLoading(false));
    }
  }

  return (
    <li className="entry-list-row-expandable">
      <button type="button" className="entry-list-row-header" onClick={toggle}>
        <CopyableText className="entry-list-hash" value={entry.hash} display={entry.hash.slice(0, 7)} stopPropagation={false} />
        <span className="entry-list-subject">{entry.subject}</span>
        <span className="entry-list-meta">
          {entry.ref} · {formatDate(entry.date)}
        </span>
        <span className="entry-list-chevron" style={{ transform: `rotate(${open ? 90 : 0}deg)` }}>
          <ChevronRightIcon />
        </span>
      </button>
      {open && (
        <div className="entry-list-diff">
          {loading && <p className="muted">Loading…</p>}
          {error && <p className="error">{error}</p>}
          {diff && diff.files.length === 0 && <p className="muted">No file changes.</p>}
          {diff && diff.files.length > 0 && (
            <div className="diff-files">
              {diff.files.map((file) => (
                <FileDiff
                  key={`${entry.hash}:${file.oldPath ?? file.path}`}
                  file={file}
                  theme={theme}
                  fetchPatch={() => api.getFilePatch(repoId, entry.hash, file.path).then((r) => r.patch)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
