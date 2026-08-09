import { useCallback, useEffect, useState } from "react";
import type { DiffResponse, GraphResponse, RepoInfo, StatusResponse } from "@minigit2/shared";
import { ApiRequestError, api } from "./api/client";
import AddRepoForm from "./components/AddRepoForm";
import ConfirmCheckoutDialog from "./components/ConfirmCheckoutDialog";
import DiffPanel from "./components/DiffPanel";
import GraphView from "./components/GraphView";
import RepoSwitcher from "./components/RepoSwitcher";
import ResizableDivider from "./components/ResizableDivider";
import StatusBar from "./components/StatusBar";

const ACTIVE_REPO_KEY = "minigit2:activeRepoId";
const DIFF_WIDTH_KEY = "minigit2:diffPaneWidth";
const MIN_DIFF_WIDTH = 240;
const MAX_DIFF_WIDTH = 800;
const DEFAULT_DIFF_WIDTH = 420;
const AUTO_REFRESH_INTERVAL_MS = 30_000;

export default function App() {
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [activeRepoId, setActiveRepoId] = useState<string | null>(() =>
    localStorage.getItem(ACTIVE_REPO_KEY),
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [pendingCheckoutRef, setPendingCheckoutRef] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
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

  const refreshGraph = useCallback(async (repoId: string) => {
    setGraphLoading(true);
    try {
      const data = await api.getGraph(repoId);
      setGraph(data);
      setGraphError(null);
    } catch (err) {
      setGraphError((err as Error).message);
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

  useEffect(() => {
    setSelectedHash(null);
    setDiff(null);
    setCheckoutError(null);
    setPendingCheckoutRef(null);
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
    const interval = setInterval(() => {
      refreshGraph(activeRepoId);
      refreshStatus(activeRepoId);
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeRepoId, refreshGraph, refreshStatus]);

  useEffect(() => {
    if (!activeRepoId || !selectedHash) {
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
  }, [activeRepoId, selectedHash]);

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

  const activeStatus = activeRepoId ? status : null;

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>minigit2</h1>
        {loadError && <p className="error">{loadError}</p>}
        <RepoSwitcher
          repos={repos}
          activeRepoId={activeRepoId}
          onSelect={setActiveRepoId}
          onRemove={handleRemoveRepo}
        />
        <AddRepoForm onAdd={handleAddRepo} />
      </aside>
      <main className="content">
        {activeRepo ? (
          <>
            <div className="content-header">
              <p className="repo-path">{activeRepo.path}</p>
              <button
                type="button"
                className="refresh-button"
                onClick={() => {
                  refreshGraph(activeRepoId!);
                  refreshStatus(activeRepoId!);
                }}
                disabled={graphLoading}
                title="Reload the graph and status now (also auto-refreshes every 30s)"
              >
                {graphLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            <StatusBar status={activeStatus} />
            {graphError && <p className="error">{graphError}</p>}
            {checkoutError && <p className="error">{checkoutError}</p>}
            <div className="workspace">
              <div className="graph-pane">
                {graph ? (
                  <GraphView
                    key={activeRepoId}
                    nodes={graph.nodes}
                    edges={graph.edges}
                    selectedHash={selectedHash}
                    onSelect={setSelectedHash}
                    onCheckoutCommit={requestCheckout}
                    onCheckoutBranch={requestCheckout}
                  />
                ) : (
                  graphLoading && <p className="muted">Loading graph…</p>
                )}
              </div>
              <ResizableDivider onResize={handleDiffPaneResize} />
              <div className="diff-pane" style={{ width: diffPaneWidth }}>
                <DiffPanel repoId={activeRepoId} diff={diff} loading={diffLoading} error={diffError} />
              </div>
            </div>
          </>
        ) : (
          <p className="muted">Select or add a repo to get started.</p>
        )}
      </main>
      {pendingCheckoutRef && (
        <ConfirmCheckoutDialog
          target={pendingCheckoutRef}
          onConfirm={() => doCheckout(pendingCheckoutRef)}
          onCancel={() => setPendingCheckoutRef(null)}
        />
      )}
    </div>
  );
}
