import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GraphResponse, RepoSummary } from "@minigit2/shared";
import { ApiRequestError, api } from "./api/client";
import { ancestorHashes } from "./search/ancestors";
import { parseDateBoundary } from "./search/dateBoundary";
import { isQueryEmpty, parseSearchQuery } from "./search/query";
import AddRepoDialog from "./components/AddRepoDialog";
import BranchesDialog from "./components/BranchesDialog";
import CommitSearch from "./components/CommitSearch";
import ConfirmCheckoutDialog from "./components/ConfirmCheckoutDialog";
import DiffPanel from "./components/DiffPanel";
import GraphView, { DEFAULT_LANE_WIDTH } from "./components/GraphView";
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
import { ToastHost, showToast } from "./design-system/toast";
import { useTheme } from "./design-system/useTheme";

const ACTIVE_REPO_KEY = "minigit2:activeRepoId";
const DIFF_WIDTH_KEY = "minigit2:diffPaneWidth";
const MIN_DIFF_WIDTH = 240;
const MAX_DIFF_WIDTH = 800;
const DEFAULT_DIFF_WIDTH = 420;
const LANE_WIDTH_KEY = "minigit2:graphLaneWidth";
const MIN_LANE_WIDTH = 40;
const MAX_LANE_WIDTH = 400;
const AUTO_REFRESH_INTERVAL_MS = 30_000;

// A commit's diff/compare content can never change once the hash exists — safe to cache
// indefinitely (the one case where the underlying commit truly disappears, a rebase/amend
// upstream, surfaces as a commit_not_found error and is handled separately, not as staleness).
const IMMUTABLE_STALE_TIME = Infinity;

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const queryClient = useQueryClient();
  const [activeRepoId, setActiveRepoId] = useState<string | null>(() =>
    localStorage.getItem(ACTIVE_REPO_KEY),
  );
  const [addRepoOpen, setAddRepoOpen] = useState(false);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [compareHash, setCompareHash] = useState<string | null>(null);
  const [pendingCheckoutRef, setPendingCheckoutRef] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [newCommitsCount, setNewCommitsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  // The input itself stays instant (searchQuery drives its value directly) — this is what
  // actually feeds the query parser and, downstream, the graph filter/highlight/minimap-tick
  // recompute across potentially thousands of commits. Debounced so a fast typist doesn't
  // trigger that full recompute-and-rerender cascade on every single keystroke, most of which
  // are throwaway intermediate states (typing "author:" alone would otherwise briefly match
  // "not empty" against nothing meaningful, "a" alone would match almost every row, etc).
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const [searchCursor, setSearchCursor] = useState(-1);
  const [showLocalDiff, setShowLocalDiff] = useState(false);
  const [stashOpen, setStashOpen] = useState(false);
  const [reflogOpen, setReflogOpen] = useState(false);
  const [branchesOpen, setBranchesOpen] = useState(false);
  const [focusedRefs, setFocusedRefs] = useState<{ hash: string; name: string }[]>([]);
  const [diffPaneWidth, setDiffPaneWidth] = useState<number>(() => {
    const stored = Number(localStorage.getItem(DIFF_WIDTH_KEY));
    return stored >= MIN_DIFF_WIDTH && stored <= MAX_DIFF_WIDTH ? stored : DEFAULT_DIFF_WIDTH;
  });
  const [graphLaneWidth, setGraphLaneWidth] = useState<number>(() => {
    const stored = Number(localStorage.getItem(LANE_WIDTH_KEY));
    return stored >= MIN_LANE_WIDTH && stored <= MAX_LANE_WIDTH ? stored : DEFAULT_LANE_WIDTH;
  });

  useEffect(() => {
    localStorage.setItem(DIFF_WIDTH_KEY, String(diffPaneWidth));
  }, [diffPaneWidth]);

  useEffect(() => {
    localStorage.setItem(LANE_WIDTH_KEY, String(graphLaneWidth));
  }, [graphLaneWidth]);

  function handleDiffPaneResize(deltaX: number) {
    setDiffPaneWidth((w) => Math.min(MAX_DIFF_WIDTH, Math.max(MIN_DIFF_WIDTH, w - deltaX)));
  }

  function handleGraphLaneResize(deltaX: number) {
    setGraphLaneWidth((w) => Math.min(MAX_LANE_WIDTH, Math.max(MIN_LANE_WIDTH, w + deltaX)));
  }

  const reposQuery = useQuery({
    queryKey: ["repos"],
    queryFn: ({ signal }) => api.listRepos(signal).then((r) => r.repos),
  });
  const repos = useMemo(() => reposQuery.data ?? [], [reposQuery.data]);

  // Keep the active repo pointed at something real once the list loads: the id from
  // localStorage might no longer exist, or nothing may be selected yet.
  useEffect(() => {
    if (!reposQuery.data) return;
    setActiveRepoId((current) => {
      if (current && reposQuery.data.some((r) => r.id === current)) return current;
      return reposQuery.data[0]?.id ?? null;
    });
  }, [reposQuery.data]);

  useEffect(() => {
    if (activeRepoId) {
      localStorage.setItem(ACTIVE_REPO_KEY, activeRepoId);
    } else {
      localStorage.removeItem(ACTIVE_REPO_KEY);
    }
  }, [activeRepoId]);

  const addRepoMutation = useMutation({ mutationFn: (path: string) => api.addRepo(path) });
  async function handleAddRepo(path: string) {
    const { repo } = await addRepoMutation.mutateAsync(path);
    queryClient.setQueryData<RepoSummary[]>(["repos"], (old) => [...(old ?? []), repo]);
    setActiveRepoId(repo.id);
  }

  const removeRepoMutation = useMutation({ mutationFn: (id: string) => api.removeRepo(id) });
  async function handleRemoveRepo(id: string) {
    await removeRepoMutation.mutateAsync(id);
    queryClient.setQueryData<RepoSummary[]>(["repos"], (old) => old?.filter((r) => r.id !== id));
    setActiveRepoId((current) => (current === id ? null : current));
  }

  const activeRepo = repos.find((r) => r.id === activeRepoId) ?? null;

  const graphQuery = useQuery({
    queryKey: ["graph", activeRepoId],
    queryFn: ({ signal }) => api.getGraph(activeRepoId!, signal),
    enabled: !!activeRepoId,
  });
  const graph = graphQuery.data ?? null;

  const statusQuery = useQuery({
    queryKey: ["status", activeRepoId],
    queryFn: ({ signal }) => api.getStatus(activeRepoId!, signal),
    enabled: !!activeRepoId,
  });
  const status = statusQuery.data ?? null;

  // Refetches the graph and folds in the "how many commits are new" banner count — shared by
  // the 30s poll and the SSE watch below, the two paths that refresh in the background without
  // the user having explicitly asked (a manual Refresh click resets the banner outright instead,
  // see its own handler further down).
  //
  // The poll's own `fetchRemote` can itself cause the server-side ref move that triggers the SSE
  // "changed" event, so both paths can call this within the same tick for the same underlying
  // change. React Query's fetchQuery dedupes the network call by queryKey, but each caller would
  // otherwise still independently read `previousHashes` before either resolves and independently
  // add the same newCount — double-counting the banner. refreshInFlightRef makes a second
  // overlapping call just await the first's in-progress run instead of starting its own.
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const refetchGraphWithNewCommitsCount = useCallback(
    (repoId: string): Promise<void> => {
      if (refreshInFlightRef.current) return refreshInFlightRef.current;
      const run = (async () => {
        const previous = queryClient.getQueryData<GraphResponse>(["graph", repoId]);
        const previousHashes = new Set((previous?.nodes ?? []).map((n) => n.hash));
        let updated: GraphResponse | null = null;
        try {
          updated = await queryClient.fetchQuery({
            queryKey: ["graph", repoId],
            queryFn: ({ signal }) => api.getGraph(repoId, signal),
          });
        } catch {
          updated = null;
        }
        if (updated) {
          const newCount = updated.nodes.filter((n) => !previousHashes.has(n.hash)).length;
          if (newCount > 0) setNewCommitsCount((count) => count + newCount);
        }
      })().finally(() => {
        refreshInFlightRef.current = null;
      });
      refreshInFlightRef.current = run;
      return run;
    },
    [queryClient],
  );

  // The selected/compared commit fell out of the repo between the graph loading and the click —
  // most often a rebase/amend/force-push upstream combined with the auto-refresh's
  // `git fetch --prune`. Recover by dropping the stale selection and reloading the graph so it no
  // longer offers that commit.
  const recoverFromStaleCommit = useCallback(
    (repoId: string) => {
      setSelectedHash(null);
      setCompareHash(null);
      showToast("That commit is no longer in the repository — refreshing the graph.");
      queryClient.invalidateQueries({ queryKey: ["graph", repoId] });
    },
    [queryClient],
  );

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
    setCheckoutError(null);
    setPendingCheckoutRef(null);
    setNewCommitsCount(0);
    setSearchQuery("");
    setSearchCursor(-1);
    setShowLocalDiff(false);
    setFocusedRefs([]);
  }, [activeRepoId]);

  // Refs (not state) so the interval/SSE effects below only reopen when the repo itself changes,
  // not on every showLocalDiff toggle — tearing either down and recreating it that often would be
  // wasteful and, for the SSE connection, would show up as connect/disconnect churn.
  const showLocalDiffRef = useRef(showLocalDiff);
  useEffect(() => {
    showLocalDiffRef.current = showLocalDiff;
  }, [showLocalDiff]);

  useEffect(() => {
    if (!activeRepoId) return;
    const interval = setInterval(async () => {
      await api.fetchRemote(activeRepoId).catch(() => {});
      await refetchGraphWithNewCommitsCount(activeRepoId);
      queryClient.invalidateQueries({ queryKey: ["status", activeRepoId] });
      if (showLocalDiffRef.current) queryClient.invalidateQueries({ queryKey: ["localDiff", activeRepoId] });
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeRepoId, refetchGraphWithNewCommitsCount, queryClient]);

  // Complements the 30s poll above with a near-instant local path: the server watches this
  // repo's .git refs (see routes/watch.ts) and pushes a "changed" event the moment something
  // moves on disk — a commit made in another terminal, a checkout, a `git pull` run outside the
  // app — without waiting for the next poll tick. Doesn't replace the poll's own `fetchRemote`
  // call (a *remote* change still needs an actual fetch to become visible locally at all).
  useEffect(() => {
    if (!activeRepoId) return;
    const source = new EventSource(`/api/repos/${activeRepoId}/watch`);
    source.addEventListener("changed", () => {
      refetchGraphWithNewCommitsCount(activeRepoId);
      queryClient.invalidateQueries({ queryKey: ["status", activeRepoId] });
      if (showLocalDiffRef.current) queryClient.invalidateQueries({ queryKey: ["localDiff", activeRepoId] });
    });
    return () => source.close();
  }, [activeRepoId, refetchGraphWithNewCommitsCount, queryClient]);

  const localDiffQuery = useQuery({
    queryKey: ["localDiff", activeRepoId],
    queryFn: ({ signal }) => api.getLocalDiff(activeRepoId!, signal),
    enabled: !!activeRepoId && showLocalDiff,
  });

  const diffQuery = useQuery({
    queryKey: ["diff", activeRepoId, selectedHash],
    queryFn: ({ signal }) => api.getDiff(activeRepoId!, selectedHash!, signal),
    enabled: !!activeRepoId && !!selectedHash && !compareHash,
    staleTime: IMMUTABLE_STALE_TIME,
  });

  const compareQuery = useQuery({
    queryKey: ["compare", activeRepoId, selectedHash, compareHash],
    queryFn: ({ signal }) => api.compare(activeRepoId!, selectedHash!, compareHash!, signal),
    enabled: !!activeRepoId && !!selectedHash && !!compareHash,
    staleTime: IMMUTABLE_STALE_TIME,
  });

  // A stale selection can 404 on either query depending on mode — recover the same way
  // regardless of which one hit it.
  useEffect(() => {
    if (!activeRepoId) return;
    const err = compareHash ? compareQuery.error : diffQuery.error;
    if (err instanceof ApiRequestError && err.code === "commit_not_found") {
      recoverFromStaleCommit(activeRepoId);
    }
  }, [activeRepoId, compareHash, diffQuery.error, compareQuery.error, recoverFromStaleCommit]);

  async function doCheckout(ref: string) {
    if (!activeRepoId) return;
    setCheckoutError(null);
    try {
      await api.checkout(activeRepoId, ref);
      setPendingCheckoutRef(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["graph", activeRepoId] }),
        queryClient.invalidateQueries({ queryKey: ["status", activeRepoId] }),
      ]);
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

  // Walks `parents` client-side from each focused head (already loaded, no extra request) to
  // find the union of their ancestor sets. Lanes are left as laid out for the full graph —
  // recomputing them for the filtered subset would need server-side layout work — so the
  // filtered view can leave gaps between lanes rather than repacking them.
  const focusHashes = useMemo(() => {
    if (focusedRefs.length === 0 || !graph) return null;
    const byHash = new Map(graph.nodes.map((n) => [n.hash, n]));
    const roots = focusedRefs.filter((r) => byHash.has(r.hash));
    if (roots.length === 0) return null;
    return ancestorHashes(
      byHash,
      roots.map((r) => r.hash),
    );
  }, [graph, focusedRefs]);

  // The graph pane renders only these — a hard filter, not a dim — so row indices need
  // renumbering to stay contiguous for GraphView's scroll/virtualization math, and edges that
  // reach outside the filtered set (into a branch that isn't focused) are dropped with it.
  const focusedNodes = useMemo(() => {
    if (!graph) return [];
    if (!focusHashes) return graph.nodes;
    return graph.nodes.filter((n) => focusHashes.has(n.hash)).map((n, row) => ({ ...n, row }));
  }, [graph, focusHashes]);

  const focusedEdges = useMemo(() => {
    if (!graph) return [];
    if (!focusHashes) return graph.edges;
    return graph.edges.filter((e) => focusHashes.has(e.from) && focusHashes.has(e.to));
  }, [graph, focusHashes]);

  const focusedNames = useMemo(() => new Set(focusedRefs.map((r) => r.name)), [focusedRefs]);

  const parsedQuery = useMemo(() => parseSearchQuery(debouncedSearchQuery), [debouncedSearchQuery]);

  // `branch:` resolves each named branch to its head commit (from the already-loaded refs) and
  // walks ancestors client-side, same mechanism as branch focus above — no extra request. An
  // empty set (not null) when none of the named branches were found, so the filter correctly
  // excludes everything rather than silently matching everything.
  const branchFilterHashes = useMemo(() => {
    if (parsedQuery.branches.length === 0 || !graph) return null;
    const byHash = new Map(graph.nodes.map((n) => [n.hash, n]));
    const starts = graph.nodes
      .filter((n) => n.refs.some((r) => parsedQuery.branches.includes(r.name)))
      .map((n) => n.hash);
    return ancestorHashes(byHash, starts);
  }, [graph, parsedQuery.branches]);

  // `file:` is the one operator that can't be answered from the already-loaded graph (commit
  // nodes don't carry which files they touched), so it's the one that needs a network
  // round-trip. parsedQuery already only updates ~200ms after typing settles (see
  // debouncedSearchQuery above), so this fires right away rather than debouncing a second time
  // on top of that.
  const fileSearchQuery = useQuery({
    queryKey: ["fileSearch", activeRepoId, parsedQuery.file],
    queryFn: ({ signal }) =>
      api.searchCommitsByFile(activeRepoId!, parsedQuery.file!, signal).then((r) => new Set(r.hashes)),
    enabled: !!activeRepoId && !!parsedQuery.file,
  });
  const fileFilterHashes = fileSearchQuery.data ?? null;

  // Client-side only (aside from the debounced `file:` lookup above) — the graph is already
  // fully loaded, so filtering it never costs a network round trip for the common case. Searches
  // within whatever branch focus currently shows: matches don't remove rows from the graph, they
  // just get highlighted, with Enter/prev-next jumping the selection (and virtualized scroll) to
  // each one in turn.
  const matchingNodes = useMemo(() => {
    if (isQueryEmpty(parsedQuery)) return [];
    const text = parsedQuery.text.toLowerCase();
    const author = parsedQuery.author?.toLowerCase() ?? null;
    const afterValid = parsedQuery.after ? parseDateBoundary(parsedQuery.after, "start") : null;
    const beforeValid = parsedQuery.before ? parseDateBoundary(parsedQuery.before, "end") : null;

    return focusedNodes.filter((n) => {
      if (
        text &&
        !(n.subject.toLowerCase().includes(text) || n.author.toLowerCase().includes(text) || n.hash.includes(text))
      )
        return false;
      if (author && !(n.author.toLowerCase().includes(author) || n.authorEmail.toLowerCase().includes(author)))
        return false;
      if (afterValid && new Date(n.date) < afterValid) return false;
      if (beforeValid && new Date(n.date) > beforeValid) return false;
      if (branchFilterHashes && !branchFilterHashes.has(n.hash)) return false;
      if (parsedQuery.file && (fileFilterHashes === null || !fileFilterHashes.has(n.hash))) return false;
      return true;
    });
  }, [focusedNodes, parsedQuery, branchFilterHashes, fileFilterHashes]);
  const matchHashes = useMemo(
    () => (!isQueryEmpty(parsedQuery) ? new Set(matchingNodes.map((n) => n.hash)) : null),
    [matchingNodes, parsedQuery],
  );

  function toggleFocusRef(hash: string, name: string) {
    setFocusedRefs((prev) =>
      prev.some((r) => r.name === name) ? prev.filter((r) => r.name !== name) : [...prev, { hash, name }],
    );
  }

  function removeFocusRef(name: string) {
    setFocusedRefs((prev) => prev.filter((r) => r.name !== name));
  }

  function clearFocus() {
    setFocusedRefs([]);
  }

  // If a focused branch's head commit falls out of the graph (deleted, or rebased away) between
  // refreshes, drop just that one from the selection instead of clearing the whole focus.
  useEffect(() => {
    if (focusedRefs.length === 0 || !graph) return;
    const liveHashes = new Set(graph.nodes.map((n) => n.hash));
    const stale = focusedRefs.filter((r) => !liveHashes.has(r.hash));
    if (stale.length === 0) return;
    setFocusedRefs((prev) => prev.filter((r) => liveHashes.has(r.hash)));
    const names = stale.map((r) => r.name).join(", ");
    showToast(
      stale.length === 1
        ? `Focused branch "${names}" was no longer found — removed from focus`
        : `Focused branches "${names}" were no longer found — removed from focus`,
    );
  }, [graph, focusedRefs]);

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

  // DiffPanel shows exactly one of these three modes at a time — surface the loading/error state
  // of whichever query is actually driving what's on screen right now.
  const activeDiffQuery = showLocalDiff ? localDiffQuery : compareHash ? compareQuery : diffQuery;
  const diffLoading = activeDiffQuery.isLoading;
  const diffErrorMessage =
    activeDiffQuery.error && !(activeDiffQuery.error instanceof ApiRequestError && activeDiffQuery.error.code === "commit_not_found")
      ? (activeDiffQuery.error as Error).message
      : null;

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
          {reposQuery.error && <p className="error">{(reposQuery.error as Error).message}</p>}
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
                    onClick={async () => {
                      await api.fetchRemote(activeRepoId!).catch(() => {});
                      await queryClient.invalidateQueries({ queryKey: ["graph", activeRepoId] });
                      queryClient.invalidateQueries({ queryKey: ["status", activeRepoId] });
                      if (showLocalDiff) queryClient.invalidateQueries({ queryKey: ["localDiff", activeRepoId] });
                      setNewCommitsCount(0);
                    }}
                    disabled={graphQuery.isFetching}
                    title="Fetch from remotes and reload the graph and status now (also auto-refreshes every 30s)"
                  >
                    <RefreshIcon />
                    {graphQuery.isFetching ? "Refreshing…" : "Refresh"}
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
              {focusedRefs.length > 0 && (
                <div className="focused-branch-banner">
                  <span>Focused:</span>
                  <div className="focused-branch-chips">
                    {focusedRefs.map((ref) => (
                      <span key={ref.name} className="focused-branch-chip">
                        {ref.name}
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          onClick={() => removeFocusRef(ref.name)}
                          aria-label={`Stop focusing ${ref.name}`}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                  {focusedRefs.length > 1 && (
                    <button type="button" className="btn btn-ghost" onClick={clearFocus}>
                      Clear all
                    </button>
                  )}
                </div>
              )}
              {graphQuery.error && <p className="error">{(graphQuery.error as Error).message}</p>}
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
                        loading={fileSearchQuery.isFetching}
                        onNext={handleSearchNext}
                        onPrev={handleSearchPrev}
                      />
                    )}
                  </div>
                  {graph ? (
                    <GraphView
                      key={activeRepoId}
                      nodes={focusedNodes}
                      edges={focusedEdges}
                      selectedHash={selectedHash}
                      compareHash={compareHash}
                      matchHashes={matchHashes}
                      theme={theme}
                      laneWidth={graphLaneWidth}
                      onLaneResize={handleGraphLaneResize}
                      onSelect={selectCommit}
                      onCompareClick={handleCompareClick}
                      onCheckoutRef={requestCheckout}
                    />
                  ) : (
                    graphQuery.isLoading && <p className="muted">Loading graph…</p>
                  )}
                </div>
                <ResizableDivider onResize={handleDiffPaneResize} />
                <div className="diff-pane" style={{ width: diffPaneWidth }}>
                  <h6>Diff</h6>
                  <DiffPanel
                    repoId={activeRepoId}
                    commit={selectedCommit}
                    diff={diffQuery.data ?? null}
                    compare={compareQuery.data ?? null}
                    localDiff={showLocalDiff ? (localDiffQuery.data ?? null) : null}
                    loading={diffLoading}
                    error={diffErrorMessage}
                    theme={theme}
                    remoteUrl={status?.remoteUrl ?? null}
                    onClearCompare={() => setCompareHash(null)}
                    onClearLocalDiff={() => setShowLocalDiff(false)}
                    onSelectCommit={selectCommit}
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
          focusedNames={focusedNames}
          onClose={() => setBranchesOpen(false)}
          onCheckoutRef={requestCheckout}
          onToggleFocusRef={toggleFocusRef}
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
