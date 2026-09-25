import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { TargetIcon } from "../design-system/icons";
import CopyableText from "./CopyableText";
import Dialog from "./Dialog";

interface Props {
  repoId: string;
  /** Hashes currently present in the graph — a tag pointing outside it (a filtered-out branch,
   * or a tag on an object the graph never loaded) can't be jumped to, so its button is disabled
   * rather than silently doing nothing. */
  graphHashes: Set<string>;
  onClose: () => void;
  onGoToCommit: (hash: string) => void;
}

export default function TagsDialog({ repoId, graphHashes, onClose, onGoToCommit }: Props) {
  const tagsQuery = useQuery({
    queryKey: ["tags", repoId],
    queryFn: ({ signal }) => api.getTags(repoId, signal).then((r) => r.tags),
  });
  const tags = tagsQuery.data ?? null;
  const error = tagsQuery.error as Error | null;

  return (
    <Dialog title="Tags" onClose={onClose} wide>
      {error && <p className="error">{error.message}</p>}
      {!error && tags === null && <p className="muted">Loading…</p>}
      {!error && tags && tags.length === 0 && <p className="muted">This repository has no tags.</p>}
      {!error && tags && tags.length > 0 && (
        <ul className="entry-list">
          {tags.map((tag) => {
            const known = graphHashes.has(tag.hash);
            return (
              <li key={tag.name} className="entry-list-row">
                <CopyableText className="entry-list-hash" value={tag.hash} display={tag.hash.slice(0, 7)} />
                <span className="entry-list-subject">
                  <span className="tag-name">{tag.name}</span>
                  {tag.subject && <span className="muted tag-subject">{tag.subject}</span>}
                </span>
                <span className="muted entry-list-date">{formatDate(tag.date)}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  title={known ? `Select ${tag.name}'s commit in the graph` : "This tag's commit isn't in the graph"}
                  aria-label={`Go to ${tag.name}`}
                  disabled={!known}
                  onClick={() => onGoToCommit(tag.hash)}
                >
                  <TargetIcon />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="dialog-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
