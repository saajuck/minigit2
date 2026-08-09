import { useEffect, useState } from "react";
import type { StashEntry } from "@minigit2/shared";
import { api } from "../api/client";
import CopyableText from "./CopyableText";

interface Props {
  repoId: string;
  onClose: () => void;
}

export default function StashDialog({ repoId, onClose }: Props) {
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
              <li key={entry.ref} className="entry-list-row">
                <CopyableText className="entry-list-hash" value={entry.hash} display={entry.hash.slice(0, 7)} />
                <span className="entry-list-subject">{entry.subject}</span>
                <span className="entry-list-meta">
                  {entry.ref} · {formatDate(entry.date)}
                </span>
              </li>
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
