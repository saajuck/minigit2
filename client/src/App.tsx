import { useCallback, useEffect, useState } from "react";
import type { GraphResponse, RepoInfo } from "@minigit2/shared";
import { api } from "./api/client";
import AddRepoForm from "./components/AddRepoForm";
import GraphView from "./components/GraphView";
import RepoSwitcher from "./components/RepoSwitcher";

const ACTIVE_REPO_KEY = "minigit2:activeRepoId";

export default function App() {
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [activeRepoId, setActiveRepoId] = useState<string | null>(() =>
    localStorage.getItem(ACTIVE_REPO_KEY),
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!activeRepoId) {
      setGraph(null);
      return;
    }
    let cancelled = false;
    setGraphError(null);
    api
      .getGraph(activeRepoId)
      .then((data) => {
        if (!cancelled) setGraph(data);
      })
      .catch((err) => {
        if (!cancelled) setGraphError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [activeRepoId]);

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
            <p className="repo-path">{activeRepo.path}</p>
            {graphError && <p className="error">{graphError}</p>}
            {graph && <GraphView nodes={graph.nodes} edges={graph.edges} />}
          </>
        ) : (
          <p className="muted">Sélectionne ou ajoute un repo pour commencer.</p>
        )}
      </main>
    </div>
  );
}
