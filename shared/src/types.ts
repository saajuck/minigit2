export interface RepoInfo {
  id: string;
  path: string;
  name: string;
  addedAt: string;
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
  color: string;
  author: string;
  authorEmail: string;
  date: string;
  subject: string;
  refs: RefDecoration[];
}

export interface GraphEdge {
  from: string;
  to: string;
  fromLane: number;
  toLane: number;
}

export interface GraphResponse {
  nodes: CommitNode[];
  edges: GraphEdge[];
}

export type FileStatus = "added" | "deleted" | "modified" | "renamed";

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

export interface StatusResponse {
  headCommit: string | null;
  branch: string | null;
  detached: boolean;
  dirty: boolean;
  staged: number;
  unstaged: number;
  untracked: number;
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
