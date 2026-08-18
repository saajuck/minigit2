import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { StashEntry } from "@minigit2/shared";
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
  const stashQuery = useQuery({
    queryKey: ["stashList", repoId],
    queryFn: ({ signal }) => api.getStashList(repoId, signal),
  });
  const entries = stashQuery.data?.entries ?? null;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog browser-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">Stash</div>
        {stashQuery.error && <p className="error">{(stashQuery.error as Error).message}</p>}
        {!stashQuery.error && entries === null && <p className="muted">Loading…</p>}
        {!stashQuery.error && entries !== null && entries.length === 0 && <p className="muted">No stash entries.</p>}
        {!stashQuery.error && entries !== null && entries.length > 0 && (
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

  const diffQuery = useQuery({
    queryKey: ["diff", repoId, entry.hash],
    queryFn: ({ signal }) => api.getDiff(repoId, entry.hash, signal),
    enabled: open,
    // Pinned to a fixed commit hash — a stash entry's own diff can never change.
    staleTime: Infinity,
  });

  return (
    <li className="entry-list-row-expandable">
      <button type="button" className="entry-list-row-header" onClick={() => setOpen((o) => !o)}>
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
          {diffQuery.isLoading && <p className="muted">Loading…</p>}
          {diffQuery.error && <p className="error">{(diffQuery.error as Error).message}</p>}
          {diffQuery.data && diffQuery.data.files.length === 0 && <p className="muted">No file changes.</p>}
          {diffQuery.data && diffQuery.data.files.length > 0 && (
            <div className="diff-files">
              {diffQuery.data.files.map((file) => (
                <FileDiff
                  key={`${entry.hash}:${file.oldPath ?? file.path}`}
                  file={file}
                  theme={theme}
                  fetchPatch={{
                    queryKey: ["filePatch", repoId, entry.hash, file.path],
                    queryFn: (signal) => api.getFilePatch(repoId, entry.hash, file.path, signal).then((r) => r.patch),
                    staleTime: Infinity,
                  }}
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
