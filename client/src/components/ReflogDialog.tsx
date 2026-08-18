import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import CopyableText from "./CopyableText";

interface Props {
  repoId: string;
  onClose: () => void;
}

export default function ReflogDialog({ repoId, onClose }: Props) {
  const reflogQuery = useQuery({
    queryKey: ["reflog", repoId],
    queryFn: ({ signal }) => api.getReflog(repoId, signal),
  });
  const entries = reflogQuery.data?.entries ?? null;
  const error = reflogQuery.error as Error | null;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog browser-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">Reflog</div>
        {error && <p className="error">{error.message}</p>}
        {!error && entries === null && <p className="muted">Loading…</p>}
        {!error && entries !== null && entries.length === 0 && <p className="muted">No reflog entries.</p>}
        {!error && entries !== null && entries.length > 0 && (
          <ul className="entry-list">
            {entries.map((entry, i) => (
              <li key={`${entry.hash}:${i}`} className="entry-list-row">
                <CopyableText className="entry-list-hash" value={entry.hash} display={entry.shortHash} />
                <span className="entry-list-subject">{entry.action}</span>
                <span className="entry-list-meta">{formatDate(entry.date)}</span>
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
