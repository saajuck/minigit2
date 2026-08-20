import { describe, expect, it } from "vitest";
import type { FilesHotspotResponse } from "@minigit2/shared";
import { getCachedHotspot, setCachedHotspot } from "./hotspotCache";

// Module-level singleton cache, same as graphCache — each test uses its own repo id/hash pair to
// stay isolated rather than resetting shared state between them.
function emptyHotspot(): FilesHotspotResponse {
  return {};
}

describe("hotspotCache", () => {
  it("returns null for a repo/hash pair that's never been cached", () => {
    expect(getCachedHotspot("repo-never-cached", "hash-a", "sig-a")).toBeNull();
  });

  it("returns the cached result when the signature still matches", () => {
    const result = emptyHotspot();
    setCachedHotspot("repo-hit", "hash-a", "sig-a", result);
    expect(getCachedHotspot("repo-hit", "hash-a", "sig-a")).toBe(result);
  });

  it("returns null when the signature has changed (a ref moved, was added, or was removed)", () => {
    setCachedHotspot("repo-stale", "hash-a", "sig-a", emptyHotspot());
    expect(getCachedHotspot("repo-stale", "hash-a", "sig-b")).toBeNull();
  });

  it("keeps different commits in the same repo independent", () => {
    const resultA = emptyHotspot();
    const resultB = emptyHotspot();
    setCachedHotspot("repo-multi", "hash-a", "sig", resultA);
    setCachedHotspot("repo-multi", "hash-b", "sig", resultB);
    expect(getCachedHotspot("repo-multi", "hash-a", "sig")).toBe(resultA);
    expect(getCachedHotspot("repo-multi", "hash-b", "sig")).toBe(resultB);
  });

  it("keeps different repos' cached results independent even for the same hash", () => {
    const resultA = emptyHotspot();
    const resultB = emptyHotspot();
    setCachedHotspot("repo-1", "hash-a", "sig", resultA);
    setCachedHotspot("repo-2", "hash-a", "sig", resultB);
    expect(getCachedHotspot("repo-1", "hash-a", "sig")).toBe(resultA);
    expect(getCachedHotspot("repo-2", "hash-a", "sig")).toBe(resultB);
  });
});
