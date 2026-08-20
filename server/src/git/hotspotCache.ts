import type { FilesHotspotResponse } from "@minigit2/shared";

interface CacheEntry {
  signature: string;
  result: FilesHotspotResponse;
}

/** Keyed by `${repoId}:${hash}` — hotspot counts are computed from the whole `--all` history, so
 * two different commits in the same repo can't share an entry (each has its own touched-file
 * set), but the same commit's result stays valid until a ref moves, exactly like graphCache. Not
 * bounded/evicted, same rationale as graphCache: a long-running session opening many distinct
 * commits is the edge case, not the common one. */
const cache = new Map<string, CacheEntry>();

function cacheKey(repoId: string, hash: string): string {
  return `${repoId}:${hash}`;
}

export function getCachedHotspot(repoId: string, hash: string, signature: string): FilesHotspotResponse | null {
  const entry = cache.get(cacheKey(repoId, hash));
  if (entry && entry.signature === signature) return entry.result;
  return null;
}

export function setCachedHotspot(repoId: string, hash: string, signature: string, result: FilesHotspotResponse): void {
  cache.set(cacheKey(repoId, hash), { signature, result });
}
