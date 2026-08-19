import type { GraphResponse } from "@minigit2/shared";

interface CacheEntry {
  signature: string;
  result: GraphResponse;
}

/** One entry per repo, keyed by repo id — a repo's whole graph is cheap to hold in memory
 * relative to recomputing it, and there's normally only a handful of repos open at once. Not
 * bounded/evicted: acceptable for the same reason repoStore's own repo list isn't (a long-running
 * desktop session accumulating many distinct repos over its lifetime is the edge case, not the
 * common one). */
const cache = new Map<string, CacheEntry>();

/** Returns the cached graph for `repoId` only if `signature` (see getRefTipsSignature) still
 * matches what it was computed against — null otherwise, meaning the caller must recompute. */
export function getCachedGraph(repoId: string, signature: string): GraphResponse | null {
  const entry = cache.get(repoId);
  if (entry && entry.signature === signature) return entry.result;
  return null;
}

export function setCachedGraph(repoId: string, signature: string, result: GraphResponse): void {
  cache.set(repoId, { signature, result });
}
