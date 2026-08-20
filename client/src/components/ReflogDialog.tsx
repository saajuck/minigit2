import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { api } from "../api/client";
import CopyableText from "./CopyableText";
import Dialog from "./Dialog";

interface Props {
  repoId: string;
  onClose: () => void;
}

// A reflog with git's default 90-day expiry can run to hundreds/thousands of entries on an
// active repo — windowed the same way FileChangeList windows a large file list, since a row's
// content (single line, ellipsis-truncated subject) never wraps, so measureElement isn't needed.
const REFLOG_ROW_HEIGHT = 34;

export default function ReflogDialog({ repoId, onClose }: Props) {
  const reflogQuery = useQuery({
    queryKey: ["reflog", repoId],
    queryFn: ({ signal }) => api.getReflog(repoId, signal),
  });
  const entries = reflogQuery.data?.entries ?? null;
  const error = reflogQuery.error as Error | null;

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: entries?.length ?? 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => REFLOG_ROW_HEIGHT,
    overscan: 10,
  });

  return (
    <Dialog title="Reflog" onClose={onClose} wide>
      {error && <p className="error">{error.message}</p>}
      {!error && entries === null && <p className="muted">Loading…</p>}
      {!error && entries !== null && entries.length === 0 && <p className="muted">No reflog entries.</p>}
      {!error && entries !== null && entries.length > 0 && (
        <div ref={scrollRef} className="entry-list">
          <div style={{ position: "relative", height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((row) => {
              const entry = entries[row.index]!;
              return (
                <div
                  key={row.key}
                  data-index={row.index}
                  className="entry-list-row"
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${row.start}px)` }}
                >
                  <CopyableText className="entry-list-hash" value={entry.hash} display={entry.shortHash} />
                  <span className="entry-list-subject">{entry.action}</span>
                  <span className="entry-list-meta">{formatDate(entry.date)}</span>
                </div>
              );
            })}
          </div>
        </div>
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
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
