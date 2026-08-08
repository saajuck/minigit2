import type {
  CheckoutResponse,
  DiffResponse,
  FilePatchResponse,
  FsListResponse,
  GraphResponse,
  RepoInfo,
  StatusResponse,
} from "@minigit2/shared";

export class ApiRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
  }
}

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
    throw new ApiRequestError(body.error ?? "unknown_error", body.message ?? `Request failed: ${res.status}`);
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
  getFilePatch: (repoId: string, hash: string, path: string) =>
    request<FilePatchResponse>(`/repos/${repoId}/commits/${hash}/diff/file?path=${encodeURIComponent(path)}`),
  getStatus: (repoId: string) => request<StatusResponse>(`/repos/${repoId}/status`),
  checkout: (repoId: string, ref: string) =>
    request<CheckoutResponse>(`/repos/${repoId}/checkout`, {
      method: "POST",
      body: JSON.stringify({ ref }),
    }),
  browseFs: (path?: string) =>
    request<FsListResponse>(`/fs${path ? `?path=${encodeURIComponent(path)}` : ""}`),
};
