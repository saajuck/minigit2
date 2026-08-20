import { useQuery } from "@tanstack/react-query";
import type { BranchInfo } from "@minigit2/shared";
import { api } from "../api/client";
import { TargetIcon } from "../design-system/icons";
import CopyableText from "./CopyableText";
import Dialog from "./Dialog";

interface Props {
  repoId: string;
  /** Changes whenever HEAD moves (e.g. after a checkout) so the dialog can refetch and move
   * the "HEAD" tag — the branch list is otherwise only fetched once, on open. */
  headRefreshKey: string | null;
  /** Names of the branches currently focused in the graph — toggles the focus button's active state. */
  focusedNames: Set<string>;
  onClose: () => void;
  onCheckoutRef: (ref: string) => void;
  onToggleFocusRef: (hash: string, name: string) => void;
}

export default function BranchesDialog({
  repoId,
  headRefreshKey,
  focusedNames,
  onClose,
  onCheckoutRef,
  onToggleFocusRef,
}: Props) {
  const branchesQuery = useQuery({
    queryKey: ["branches", repoId, headRefreshKey],
    queryFn: ({ signal }) => api.getBranches(repoId, signal),
  });
  const data = branchesQuery.data ?? null;
  const error = branchesQuery.error as Error | null;

  return (
    <Dialog title="Branches" onClose={onClose} wide>
      {error && <p className="error">{error.message}</p>}
      {!error && data === null && <p className="muted">Loading…</p>}
      {!error && data && (
        <>
          <BranchGroup
            title="Local"
            branches={data.local}
            defaultBranch={data.defaultBranch}
            focusedNames={focusedNames}
            onCheckoutRef={onCheckoutRef}
            onToggleFocusRef={onToggleFocusRef}
          />
          <BranchGroup
            title="Remote"
            branches={data.remote}
            defaultBranch={data.defaultBranch}
            qualifyDefault={(name) => name.endsWith(`/${data.defaultBranch}`)}
            focusedNames={focusedNames}
            onCheckoutRef={onCheckoutRef}
            onToggleFocusRef={onToggleFocusRef}
          />
        </>
      )}
      <div className="dialog-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  );
}

interface GroupProps {
  title: string;
  branches: BranchInfo[];
  defaultBranch: string | null;
  qualifyDefault?: (name: string) => boolean;
  focusedNames: Set<string>;
  onCheckoutRef: (ref: string) => void;
  onToggleFocusRef: (hash: string, name: string) => void;
}

function BranchGroup({
  title,
  branches,
  defaultBranch,
  qualifyDefault,
  focusedNames,
  onCheckoutRef,
  onToggleFocusRef,
}: GroupProps) {
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
                className={`btn btn-ghost btn-icon entry-list-row-focus${focusedNames.has(b.name) ? " active" : ""}`}
                title={focusedNames.has(b.name) ? `Stop focusing ${b.name}` : `Focus ${b.name} in the graph`}
                aria-label={`Focus ${b.name}`}
                aria-pressed={focusedNames.has(b.name)}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFocusRef(b.hash, b.name);
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
