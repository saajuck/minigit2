import type {
  BlameResponse,
  BranchesResponse,
  CheckoutResponse,
  CompareResponse,
  DiffResponse,
  FilePatchResponse,
  FilesHotspotResponse,
  FileSearchResponse,
  FsListResponse,
  GraphResponse,
  LocalDiffResponse,
  ReflogResponse,
  RepoSummary,
  StashListResponse,
  StatusResponse,
} from "@minigit2/shared";
import { showToast } from "../design-system/toast";

export class ApiRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
  }
}

// Error codes with their own dedicated, expected inline UI (form validation, the dirty-worktree
// confirm dialog, etc.) — toasting those on top would just be noise. Everything else, chiefly the
// server's "git_error" for a failed git command, is unexpected and easy to miss if it only ever
// updates some local state (or, worse, is silently swallowed) — so it always gets a toast too.
const SILENT_CODES = new Set([
  "invalid_path",
  "invalid_ref",
  "invalid_refs",
  "invalid_request",
  "already_added",
  "not_found",
  "dirty_worktree",
  "not_a_directory",
  // The selected/compared commit fell out of the repo (rebase, amend, or the auto-fetch's
  // `--prune`) between the graph loading and the click — App.tsx recovers by refreshing the
  // graph and clearing the stale selection, with its own toast, so this stays silent here.
  "commit_not_found",
  // Fetching from remotes is opportunistic (runs on every refresh) — offline, no remote
  // configured, or a missing credential are all routine, not something to alarm the user with.
  "fetch_error",
  // Hotspot stats are fetched automatically for every file in a diff, not user-triggered — a
  // failure just means that one file's badge doesn't show, not worth a toast.
  "hotspot_error",
]);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch (err) {
    // An aborted fetch (React Query cancelling a stale/unmounted query) also lands here —
    // it's not a real network failure, so it shouldn't toast or be treated as an app error.
    // React Query recognizes this shape internally and drops it silently.
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    showToast(`Network error: ${(err as Error).message}`);
    throw err;
  }
  if (!res.ok) {
    let body: { error?: string; message?: string } = {};
    try {
      body = await res.json();
    } catch {
      // no JSON body, keep default message below
    }
    const code = body.error ?? "unknown_error";
    const message = body.message ?? `Request failed: ${res.status}`;
    if (!SILENT_CODES.has(code)) {
      showToast(message);
    }
    throw new ApiRequestError(code, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  listRepos: (signal?: AbortSignal) => request<{ repos: RepoSummary[] }>("/repos", { signal }),
  addRepo: (path: string) =>
    request<{ repo: RepoSummary }>("/repos", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  removeRepo: (id: string) => request<void>(`/repos/${id}`, { method: "DELETE" }),
  getGraph: (repoId: string, signal?: AbortSignal) =>
    request<GraphResponse>(`/repos/${repoId}/graph`, { signal }),
  getDiff: (repoId: string, hash: string, signal?: AbortSignal) =>
    request<DiffResponse>(`/repos/${repoId}/commits/${hash}/diff`, { signal }),
  getFilePatch: (repoId: string, hash: string, path: string, signal?: AbortSignal) =>
    request<FilePatchResponse>(`/repos/${repoId}/commits/${hash}/diff/file?path=${encodeURIComponent(path)}`, {
      signal,
    }),
  getFileBlame: (repoId: string, hash: string, path: string, signal?: AbortSignal) =>
    request<BlameResponse>(`/repos/${repoId}/commits/${hash}/blame?path=${encodeURIComponent(path)}`, { signal }),
  getFilesHotspot: (repoId: string, hash: string, signal?: AbortSignal) =>
    request<FilesHotspotResponse>(`/repos/${repoId}/commits/${hash}/hotspot`, { signal }),
  getStatus: (repoId: string, signal?: AbortSignal) =>
    request<StatusResponse>(`/repos/${repoId}/status`, { signal }),
  checkout: (repoId: string, ref: string) =>
    request<CheckoutResponse>(`/repos/${repoId}/checkout`, {
      method: "POST",
      body: JSON.stringify({ ref }),
    }),
  browseFs: (path?: string, signal?: AbortSignal) =>
    request<FsListResponse>(`/fs${path ? `?path=${encodeURIComponent(path)}` : ""}`, { signal }),
  compare: (repoId: string, from: string, to: string, signal?: AbortSignal) =>
    request<CompareResponse>(
      `/repos/${repoId}/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { signal },
    ),
  getComparePatch: (repoId: string, from: string, to: string, path: string, signal?: AbortSignal) =>
    request<FilePatchResponse>(
      `/repos/${repoId}/compare/file?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&path=${encodeURIComponent(path)}`,
      { signal },
    ),
  getStashList: (repoId: string, signal?: AbortSignal) =>
    request<StashListResponse>(`/repos/${repoId}/stash`, { signal }),
  getReflog: (repoId: string, signal?: AbortSignal) =>
    request<ReflogResponse>(`/repos/${repoId}/reflog`, { signal }),
  getLocalDiff: (repoId: string, signal?: AbortSignal) =>
    request<LocalDiffResponse>(`/repos/${repoId}/local-diff`, { signal }),
  getLocalDiffPatch: (repoId: string, path: string, signal?: AbortSignal) =>
    request<FilePatchResponse>(`/repos/${repoId}/local-diff/file?path=${encodeURIComponent(path)}`, { signal }),
  getBranches: (repoId: string, signal?: AbortSignal) =>
    request<BranchesResponse>(`/repos/${repoId}/branches`, { signal }),
  searchCommitsByFile: (repoId: string, pathspec: string, signal?: AbortSignal) =>
    request<FileSearchResponse>(`/repos/${repoId}/search/files?path=${encodeURIComponent(pathspec)}`, { signal }),
  fetchRemote: (repoId: string) => request<{ ok: true }>(`/repos/${repoId}/fetch`, { method: "POST" }),
};
