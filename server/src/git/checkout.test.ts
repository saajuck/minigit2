import { describe, expect, it } from "vitest";
import { resolveRemoteShortName } from "./checkout";

describe("resolveRemoteShortName", () => {
  it("strips a single remote's prefix", () => {
    expect(resolveRemoteShortName("origin/main", ["origin"])).toEqual({
      shortName: "main",
      remoteRef: "origin/main",
    });
  });

  it("picks the correct remote among several", () => {
    expect(resolveRemoteShortName("upstream/feature/x", ["origin", "upstream"])).toEqual({
      shortName: "feature/x",
      remoteRef: "upstream/feature/x",
    });
  });

  it("falls back to treating ref as the short name when no remote prefix matches", () => {
    // Shouldn't happen in practice (caller only calls this once show-ref already confirmed ref
    // is a real remote-tracking ref), but the function must still degrade safely.
    expect(resolveRemoteShortName("origin/main", ["upstream"])).toEqual({
      shortName: "origin/main",
      remoteRef: null,
    });
  });

  it("doesn't false-match a remote name that's merely a prefix of another remote's name", () => {
    // "origin-mirror/main" must not match remote "origin" (no "/" right after "origin").
    expect(resolveRemoteShortName("origin-mirror/main", ["origin", "origin-mirror"])).toEqual({
      shortName: "main",
      remoteRef: "origin-mirror/main",
    });
  });

  it("resolves the ambiguous case (a remote name containing a slash) by iteration order", () => {
    // Both "a" (shortName "b/c") and "a/b" (shortName "c") are valid readings of "a/b/c" — the
    // first remote in the list that matches wins, mirroring `git remote`'s print order.
    expect(resolveRemoteShortName("a/b/c", ["a", "a/b"])).toEqual({ shortName: "b/c", remoteRef: "a/b/c" });
    expect(resolveRemoteShortName("a/b/c", ["a/b", "a"])).toEqual({ shortName: "c", remoteRef: "a/b/c" });
  });

  it("doesn't treat the remote name alone (no trailing branch) as a match", () => {
    // ref === remote with nothing after it: startsWith("origin/") is false for ref "origin".
    expect(resolveRemoteShortName("origin", ["origin"])).toEqual({ shortName: "origin", remoteRef: null });
  });
});
