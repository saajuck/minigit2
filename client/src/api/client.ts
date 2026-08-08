import type { DiffResponse, GraphResponse, RepoInfo } from "@minigit2/shared";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let body: { error?: string; message?: string } = {};
    try {
      body = await res.json();
    } catch {
      // no JSON body, keep default message below
    }
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  listRepos: () => request<{ repos: RepoInfo[] }>("/repos"),
  addRepo: (path: string) =>
    request<{ repo: RepoInfo }>("/repos", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  removeRepo: (id: string) => request<void>(`/repos/${id}`, { method: "DELETE" }),
  getGraph: (repoId: string) => request<GraphResponse>(`/repos/${repoId}/graph`),
  getDiff: (repoId: string, hash: string) =>
    request<DiffResponse>(`/repos/${repoId}/commits/${hash}/diff`),
};
