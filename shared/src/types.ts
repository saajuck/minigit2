export interface RepoInfo {
  id: string;
  path: string;
  name: string;
  addedAt: string;
}

/** RepoInfo plus a live snapshot of branch/dirty state, computed at request time (not persisted). */
export interface RepoSummary extends RepoInfo {
  branch: string | null;
  detached: boolean;
  dirty: boolean;
}

export interface FsDirectory {
  name: string;
  path: string;
}

export interface FsListResponse {
  path: string;
  parent: string | null;
  directories: FsDirectory[];
}

export interface RefDecoration {
  type: "branch" | "remote" | "tag";
  name: string;
  isHead: boolean;
}

export interface CommitNode {
  hash: string;
  parents: string[];
  row: number;
  lane: number;
  /** Identifies which continuous branch run this commit belongs to, for coloring — stable
   * across the whole run even where `lane` itself shifts (e.g. around a merge), so a single
   * branch never appears to change color partway through. Not theme-aware (just a palette
   * index); the client picks the actual color via its own theme-scoped palette. */
  colorGroup: number;
  author: string;
  authorEmail: string;
  authorAvatarUrl: string;
  date: string;
  subject: string;
  refs: RefDecoration[];
}

export interface GraphEdge {
  from: string;
  to: string;
  fromLane: number;
  toLane: number;
  colorGroup: number;
}

export interface GraphResponse {
  nodes: CommitNode[];
  edges: GraphEdge[];
}

export type FileStatus = "added" | "deleted" | "modified" | "renamed" | "untracked";

export interface FileDiffSummary {
  path: string;
  oldPath?: string;
  status: FileStatus;
}

export interface DiffResponse {
  hash: string;
  parentHash: string | null;
  files: FileDiffSummary[];
}

export interface FilePatchResponse {
  path: string;
  patch: string;
}

export interface BlameLine {
  hash: string;
  author: string;
  authorEmail: string;
  authorAvatarUrl: string;
  date: string;
  summary: string;
  lineNumber: number;
  content: string;
}

export interface BlameResponse {
  path: string;
  lines: BlameLine[];
}

export interface AheadBehind {
  ahead: number;
  behind: number;
}

export interface StatusResponse {
  headCommit: string | null;
  branch: string | null;
  detached: boolean;
  dirty: boolean;
  staged: number;
  unstaged: number;
  untracked: number;
  /** Null when detached, or the branch has no configured upstream. */
  aheadBehind: AheadBehind | null;
}

export interface CompareResponse {
  from: string;
  to: string;
  files: FileDiffSummary[];
}

export interface BranchInfo {
  name: string;
  hash: string;
  isHead: boolean;
}

export interface BranchesResponse {
  local: BranchInfo[];
  remote: BranchInfo[];
  /** Short name (e.g. "main"), resolved from origin/HEAD or a best-effort guess. Null if undetermined. */
  defaultBranch: string | null;
}

export interface StashEntry {
  /** e.g. "stash@{0}" */
  ref: string;
  hash: string;
  subject: string;
  date: string;
}

export interface StashListResponse {
  entries: StashEntry[];
}

export interface ReflogEntry {
  hash: string;
  shortHash: string;
  /** git's %gs — the reflog subject, e.g. "checkout: moving from main to feature" */
  action: string;
  date: string;
}

export interface ReflogResponse {
  entries: ReflogEntry[];
}

export interface LocalDiffResponse {
  files: FileDiffSummary[];
}

export interface CheckoutRequest {
  ref: string;
}

export interface CheckoutResponse {
  ok: true;
  status: StatusResponse;
}

export interface ApiErrorBody {
  error: string;
  message: string;
}
