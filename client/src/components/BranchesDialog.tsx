import { useEffect, useState } from "react";
import type { BranchInfo, BranchesResponse } from "@minigit2/shared";
import { api } from "../api/client";
import { TargetIcon } from "../design-system/icons";
import CopyableText from "./CopyableText";

interface Props {
  repoId: string;
  /** Changes whenever HEAD moves (e.g. after a checkout) so the dialog can refetch and move
   * the "HEAD" tag — the branch list is otherwise only fetched once, on open. */
  headRefreshKey: string | null;
  onClose: () => void;
  onCheckoutRef: (ref: string) => void;
  onFocusRef: (hash: string, name: string) => void;
}

export default function BranchesDialog({ repoId, headRefreshKey, onClose, onCheckoutRef, onFocusRef }: Props) {
  const [data, setData] = useState<BranchesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getBranches(repoId)
      .then(setData)
      .catch((err) => setError((err as Error).message));
  }, [repoId, headRefreshKey]);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog browser-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">Branches</div>
        {error && <p className="error">{error}</p>}
        {!error && data === null && <p className="muted">Loading…</p>}
        {!error && data && (
          <>
            <BranchGroup
              title="Local"
              branches={data.local}
              defaultBranch={data.defaultBranch}
              onCheckoutRef={onCheckoutRef}
              onFocusRef={onFocusRef}
            />
            <BranchGroup
              title="Remote"
              branches={data.remote}
              defaultBranch={data.defaultBranch}
              qualifyDefault={(name) => name.endsWith(`/${data.defaultBranch}`)}
              onCheckoutRef={onCheckoutRef}
              onFocusRef={onFocusRef}
            />
          </>
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

interface GroupProps {
  title: string;
  branches: BranchInfo[];
  defaultBranch: string | null;
  qualifyDefault?: (name: string) => boolean;
  onCheckoutRef: (ref: string) => void;
  onFocusRef: (hash: string, name: string) => void;
}

function BranchGroup({ title, branches, defaultBranch, qualifyDefault, onCheckoutRef, onFocusRef }: GroupProps) {
  const isDefault = qualifyDefault ?? ((name: string) => name === defaultBranch);
  return (
    <div className="branch-group">
      <h6 className="branch-group-title">
        {title} ({branches.length})
      </h6>
      {branches.length === 0 ? (
        <p className="muted">None.</p>
      ) : (
        <ul className="entry-list">
          {branches.map((b) => (
            <li
              key={b.name}
              className="entry-list-row entry-list-row-interactive"
              title="Double-click to check out"
              onDoubleClick={() => onCheckoutRef(b.name)}
            >
              <CopyableText className="entry-list-hash" value={b.hash} display={b.hash.slice(0, 7)} />
              <span className="entry-list-subject">
                {b.name}
                {b.isHead && (
                  <span className="tag tag-neutral branch-tag">
                    HEAD
                  </span>
                )}
                {isDefault(b.name) && (
                  <span className="tag tag-neutral branch-tag">
                    default
                  </span>
                )}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-icon entry-list-row-focus"
                title="Focus this branch in the graph"
                aria-label={`Focus ${b.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onFocusRef(b.hash, b.name);
                }}
              >
                <TargetIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
