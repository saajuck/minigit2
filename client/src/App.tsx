import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CompareResponse,
  DiffResponse,
  GraphResponse,
  LocalDiffResponse,
  RepoSummary,
  StatusResponse,
} from "@minigit2/shared";
import { ApiRequestError, api } from "./api/client";
import AddRepoDialog from "./components/AddRepoDialog";
import BranchesDialog from "./components/BranchesDialog";
import CommitSearch from "./components/CommitSearch";
import ConfirmCheckoutDialog from "./components/ConfirmCheckoutDialog";
import DiffPanel from "./components/DiffPanel";
import GraphView from "./components/GraphView";
import ReflogDialog from "./components/ReflogDialog";
import RepoSwitcher from "./components/RepoSwitcher";
import ResizableDivider from "./components/ResizableDivider";
import StashDialog from "./components/StashDialog";
import StatusChips from "./components/StatusChips";
import {
  ArchiveIcon,
  FileEditIcon,
  GitBranchIcon,
  HistoryIcon,
  ListBranchesIcon,
  MoonIcon,
  PlusIcon,
  RefreshIcon,
  SunIcon,
} from "./design-system/icons";
import { ToastHost } from "./design-system/toast";
import { useTheme } from "./design-system/useTheme";

const ACTIVE_REPO_KEY = "minigit2:activeRepoId";
const DIFF_WIDTH_KEY = "minigit2:diffPaneWidth";
const MIN_DIFF_WIDTH = 240;
const MAX_DIFF_WIDTH = 800;
const DEFAULT_DIFF_WIDTH = 420;
const AUTO_REFRESH_INTERVAL_MS = 30_000;

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [activeRepoId, setActiveRepoId] = useState<string | null>(() =>
    localStorage.getItem(ACTIVE_REPO_KEY),
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addRepoOpen, setAddRepoOpen] = useState(false);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [compareHash, setCompareHash] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [compare, setCompare] = useState<CompareResponse | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [pendingCheckoutRef, setPendingCheckoutRef] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [newCommitsCount, setNewCommitsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCursor, setSearchCursor] = useState(-1);
  const [showLocalDiff, setShowLocalDiff] = useState(false);
  const [localDiff, setLocalDiff] = useState<LocalDiffResponse | null>(null);
  const [stashOpen, setStashOpen] = useState(false);
  const [reflogOpen, setReflogOpen] = useState(false);
  const [branchesOpen, setBranchesOpen] = useState(false);
  const [diffPaneWidth, setDiffPaneWidth] = useState<number>(() => {
    const stored = Number(localStorage.getItem(DIFF_WIDTH_KEY));
    return stored >= MIN_DIFF_WIDTH && stored <= MAX_DIFF_WIDTH ? stored : DEFAULT_DIFF_WIDTH;
  });

  useEffect(() => {
    localStorage.setItem(DIFF_WIDTH_KEY, String(diffPaneWidth));
  }, [diffPaneWidth]);

  function handleDiffPaneResize(deltaX: number) {
    setDiffPaneWidth((w) => Math.min(MAX_DIFF_WIDTH, Math.max(MIN_DIFF_WIDTH, w - deltaX)));
  }

  const refreshRepos = useCallback(async () => {
    try {
      const { repos } = await api.listRepos();
      setRepos(repos);
      setActiveRepoId((current) => {
        if (current && repos.some((r) => r.id === current)) return current;
        return repos[0]?.id ?? null;
      });
    } catch (err) {
      setLoadError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    refreshRepos();
  }, [refreshRepos]);

  useEffect(() => {
    if (activeRepoId) {
      localStorage.setItem(ACTIVE_REPO_KEY, activeRepoId);
    } else {
      localStorage.removeItem(ACTIVE_REPO_KEY);
    }
  }, [activeRepoId]);

  async function handleAddRepo(path: string) {
    const { repo } = await api.addRepo(path);
    setRepos((prev) => [...prev, repo]);
    setActiveRepoId(repo.id);
  }

  async function handleRemoveRepo(id: string) {
    await api.removeRepo(id);
    setRepos((prev) => prev.filter((r) => r.id !== id));
    setActiveRepoId((current) => (current === id ? null : current));
  }

  const activeRepo = repos.find((r) => r.id === activeRepoId) ?? null;

  const refreshGraph = useCallback(async (repoId: string): Promise<GraphResponse | null> => {
    setGraphLoading(true);
    try {
      const data = await api.getGraph(repoId);
      setGraph(data);
      setGraphError(null);
      return data;
    } catch (err) {
      setGraphError((err as Error).message);
      return null;
    } finally {
      setGraphLoading(false);
    }
  }, []);

  const refreshStatus = useCallback(async (repoId: string) => {
    try {
      setStatus(await api.getStatus(repoId));
    } catch {
      setStatus(null);
    }
  }, []);

  const refreshLocalDiff = useCallback(async (repoId: string) => {
    try {
      setLocalDiff(await api.getLocalDiff(repoId));
    } catch {
      setLocalDiff(null);
    }
  }, []);

  function selectCommit(hash: string) {
    setSelectedHash(hash);
    setCompareHash(null);
    setShowLocalDiff(false);
  }

  function handleCompareClick(hash: string) {
    setShowLocalDiff(false);
    if (compareHash === hash) {
      setCompareHash(null);
      return;
    }
    if (!selectedHash || selectedHash === hash) {
      setSelectedHash(hash);
      setCompareHash(null);
      return;
    }
    setCompareHash(hash);
  }

  function openLocalDiff() {
    setSelectedHash(null);
    setCompareHash(null);
    setShowLocalDiff(true);
  }

  useEffect(() => {
    setSelectedHash(null);
    setCompareHash(null);
    setDiff(null);
    setCheckoutError(null);
    setPendingCheckoutRef(null);
    setNewCommitsCount(0);
    setSearchQuery("");
    setSearchCursor(-1);
    setShowLocalDiff(false);
    setLocalDiff(null);
    if (!activeRepoId) {
      setGraph(null);
      setStatus(null);
      return;
    }
    refreshGraph(activeRepoId);
    refreshStatus(activeRepoId);
  }, [activeRepoId, refreshGraph, refreshStatus]);

  useEffect(() => {
    if (!activeRepoId) return;
    const interval = setInterval(async () => {
      const previousHashes = new Set((graph?.nodes ?? []).map((n) => n.hash));
      const updated = await refreshGraph(activeRepoId);
      refreshStatus(activeRepoId);
      if (showLocalDiff) refreshLocalDiff(activeRepoId);
      if (updated) {
        const newCount = updated.nodes.filter((n) => !previousHashes.has(n.hash)).length;
        if (newCount > 0) setNewCommitsCount((count) => count + newCount);
      }
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeRepoId, refreshGraph, refreshStatus, refreshLocalDiff, showLocalDiff, graph]);

  useEffect(() => {
    if (!activeRepoId || !showLocalDiff) return;
    let cancelled = false;
    setDiffLoading(true);
    setDiffError(null);
    api
      .getLocalDiff(activeRepoId)
      .then((data) => {
        if (!cancelled) setLocalDiff(data);
      })
      .catch((err) => {
        if (!cancelled) setDiffError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setDiffLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeRepoId, showLocalDiff]);

  useEffect(() => {
    if (!activeRepoId || !selectedHash || compareHash) {
      setDiff(null);
      return;
    }
    let cancelled = false;
    setDiffLoading(true);
    setDiffError(null);
    api
      .getDiff(activeRepoId, selectedHash)
      .then((data) => {
        if (!cancelled) setDiff(data);
      })
      .catch((err) => {
        if (!cancelled) setDiffError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setDiffLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeRepoId, selectedHash, compareHash]);

  useEffect(() => {
    if (!activeRepoId || !selectedHash || !compareHash) {
      setCompare(null);
      return;
    }
    let cancelled = false;
    setDiffLoading(true);
    setDiffError(null);
    api
      .compare(activeRepoId, selectedHash, compareHash)
      .then((data) => {
        if (!cancelled) setCompare(data);
      })
      .catch((err) => {
        if (!cancelled) setDiffError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setDiffLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeRepoId, selectedHash, compareHash]);

  async function doCheckout(ref: string) {
    if (!activeRepoId) return;
    setCheckoutError(null);
    try {
      await api.checkout(activeRepoId, ref);
      setPendingCheckoutRef(null);
      await Promise.all([refreshGraph(activeRepoId), refreshStatus(activeRepoId)]);
    } catch (err) {
      setPendingCheckoutRef(null);
      if (err instanceof ApiRequestError) {
        setCheckoutError(err.message);
      } else {
        setCheckoutError((err as Error).message);
      }
    }
  }

  function requestCheckout(ref: string) {
    if (status?.dirty) {
      setPendingCheckoutRef(ref);
      return;
    }
    doCheckout(ref);
  }

  const selectedCommit = graph?.nodes.find((n) => n.hash === selectedHash) ?? null;

  // Client-side only — the graph is already fully loaded, so filtering it never costs a
  // network round trip. Matches don't remove rows from the graph (that would require
  // recomputing lanes/edges for an arbitrary subgraph); they just get highlighted, with
  // Enter/prev-next jumping the selection (and virtualized scroll) to each one in turn.
  const matchingNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !graph) return [];
    return graph.nodes.filter(
      (n) => n.subject.toLowerCase().includes(q) || n.author.toLowerCase().includes(q) || n.hash.includes(q),
    );
  }, [graph, searchQuery]);
  const matchHashes = useMemo(
    () => (searchQuery.trim() ? new Set(matchingNodes.map((n) => n.hash)) : null),
    [matchingNodes, searchQuery],
  );

  function handleSearchQueryChange(q: string) {
    setSearchQuery(q);
    setSearchCursor(-1);
  }

  function jumpToMatch(index: number) {
    const node = matchingNodes[index];
    if (!node) return;
    setSearchCursor(index);
    selectCommit(node.hash);
  }

  function handleSearchNext() {
    if (matchingNodes.length === 0) return;
    jumpToMatch((searchCursor + 1) % matchingNodes.length);
  }

  function handleSearchPrev() {
    if (matchingNodes.length === 0) return;
    jumpToMatch((searchCursor - 1 + matchingNodes.length) % matchingNodes.length);
  }

  return (
    <div data-theme={theme} className="app-root">
      <div className="nav">
        <span className="nav-brand">
          <GitBranchIcon />
          minigit2
        </span>
        <span className="tag tag-neutral">local · read-only</span>
        <button type="button" className="btn btn-ghost btn-icon" title="Toggle theme" onClick={toggleTheme}>
          {theme === "dark" ? <MoonIcon /> : <SunIcon />}
        </button>
      </div>

      <div className="body-row">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h6>Repositories</h6>
          </div>
          {loadError && <p className="error">{loadError}</p>}
          <RepoSwitcher
            repos={repos}
            activeRepoId={activeRepoId}
            theme={theme}
            onSelect={setActiveRepoId}
            onRemove={handleRemoveRepo}
          />
          <button
            type="button"
            className="btn btn-secondary btn-block sidebar-add-btn"
            onClick={() => setAddRepoOpen(true)}
          >
            <PlusIcon />
            Add repository
          </button>
        </aside>

        <main className="content">
          {activeRepo ? (
            <>
              <div className="content-header">
                <div>
                  <h6>Active repository</h6>
                  <div className="repo-path">{activeRepo.path}</div>
                </div>
                <div className="content-header-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={openLocalDiff}
                    title="Show uncommitted working tree changes"
                  >
                    <FileEditIcon />
                    Local changes
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setBranchesOpen(true)}
                    title="List local and remote branches"
                  >
                    <ListBranchesIcon />
                    Branches
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setStashOpen(true)}
                    title="View stashed changes"
                  >
                    <ArchiveIcon />
                    Stash
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setReflogOpen(true)}
                    title="View reflog"
                  >
                    <HistoryIcon />
                    Reflog
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      refreshGraph(activeRepoId!);
                      refreshStatus(activeRepoId!);
                      if (showLocalDiff) refreshLocalDiff(activeRepoId!);
                      setNewCommitsCount(0);
                    }}
                    disabled={graphLoading}
                    title="Reload the graph and status now (also auto-refreshes every 30s)"
                  >
                    <RefreshIcon />
                    {graphLoading ? "Refreshing…" : "Refresh"}
                  </button>
                </div>
              </div>
              <StatusChips status={status} theme={theme} />
              {newCommitsCount > 0 && (
                <div className="new-commits-banner">
                  <span>
                    {newCommitsCount} new commit{newCommitsCount === 1 ? "" : "s"} loaded
                  </span>
                  <button type="button" className="btn btn-ghost" onClick={() => setNewCommitsCount(0)}>
                    Dismiss
                  </button>
                </div>
              )}
              {graphError && <p className="error">{graphError}</p>}
              {checkoutError && <p className="error">{checkoutError}</p>}
              <div className="workspace">
                <div className="graph-pane">
                  <div className="graph-pane-header">
                    <h6>Commit graph</h6>
                    {graph && graph.nodes.length > 0 && (
                      <CommitSearch
                        query={searchQuery}
                        onQueryChange={handleSearchQueryChange}
                        matchCount={matchingNodes.length}
                        onNext={handleSearchNext}
                        onPrev={handleSearchPrev}
                      />
                    )}
                  </div>
                  {graph ? (
                    <GraphView
                      key={activeRepoId}
                      nodes={graph.nodes}
                      edges={graph.edges}
                      selectedHash={selectedHash}
                      compareHash={compareHash}
                      matchHashes={matchHashes}
                      theme={theme}
                      onSelect={selectCommit}
                      onCompareClick={handleCompareClick}
                      onCheckoutRef={requestCheckout}
                    />
                  ) : (
                    graphLoading && <p className="muted">Loading graph…</p>
                  )}
                </div>
                <ResizableDivider onResize={handleDiffPaneResize} />
                <div className="diff-pane" style={{ width: diffPaneWidth }}>
                  <h6>Diff</h6>
                  <DiffPanel
                    repoId={activeRepoId}
                    commit={selectedCommit}
                    diff={diff}
                    compare={compare}
                    localDiff={showLocalDiff ? localDiff : null}
                    loading={diffLoading}
                    error={diffError}
                    theme={theme}
                    onClearCompare={() => setCompareHash(null)}
                    onClearLocalDiff={() => setShowLocalDiff(false)}
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="no-active-repo">Select or add a repository to begin.</p>
          )}
        </main>
      </div>

      {addRepoOpen && <AddRepoDialog onAdd={handleAddRepo} onClose={() => setAddRepoOpen(false)} />}
      {stashOpen && activeRepoId && (
        <StashDialog repoId={activeRepoId} theme={theme} onClose={() => setStashOpen(false)} />
      )}
      {reflogOpen && activeRepoId && <ReflogDialog repoId={activeRepoId} onClose={() => setReflogOpen(false)} />}
      {branchesOpen && activeRepoId && (
        <BranchesDialog
          repoId={activeRepoId}
          headRefreshKey={status ? `${status.branch ?? ""}:${status.headCommit ?? ""}` : null}
          onClose={() => setBranchesOpen(false)}
          onCheckoutRef={requestCheckout}
        />
      )}
      {pendingCheckoutRef && (
        <ConfirmCheckoutDialog
          target={pendingCheckoutRef}
          onConfirm={() => doCheckout(pendingCheckoutRef)}
          onCancel={() => setPendingCheckoutRef(null)}
        />
      )}
      <ToastHost />
    </div>
  );
}
