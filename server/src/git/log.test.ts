import { describe, expect, it } from "vitest";
import { parseRefDecorations } from "./log";

describe("parseRefDecorations", () => {
  it("returns an empty list for a commit with no refs", () => {
    expect(parseRefDecorations("")).toEqual([]);
    expect(parseRefDecorations("   ")).toEqual([]);
  });

  it("parses a plain local branch", () => {
    expect(parseRefDecorations("refs/heads/main")).toEqual([{ type: "branch", name: "main", isHead: false }]);
  });

  it("parses the checked-out branch, marked via 'HEAD -> '", () => {
    expect(parseRefDecorations("HEAD -> refs/heads/main")).toEqual([
      { type: "branch", name: "main", isHead: true },
    ]);
  });

  it("parses a detached HEAD (bare 'HEAD', no arrow)", () => {
    expect(parseRefDecorations("HEAD")).toEqual([{ type: "branch", name: "HEAD", isHead: true }]);
  });

  it("parses a tag", () => {
    expect(parseRefDecorations("tag: refs/tags/v1.0.0")).toEqual([
      { type: "tag", name: "v1.0.0", isHead: false },
    ]);
  });

  it("parses a remote-tracking branch", () => {
    expect(parseRefDecorations("refs/remotes/origin/main")).toEqual([
      { type: "remote", name: "origin/main", isHead: false },
    ]);
  });

  it("parses several comma-separated decorations on one commit", () => {
    expect(parseRefDecorations("HEAD -> refs/heads/main, tag: refs/tags/v1.0, refs/remotes/origin/main")).toEqual([
      { type: "branch", name: "main", isHead: true },
      { type: "tag", name: "v1.0", isHead: false },
      { type: "remote", name: "origin/main", isHead: false },
    ]);
  });

  it("falls back to a bare branch entry for an unrecognized ref namespace", () => {
    // e.g. refs/stash, or anything not under heads/remotes/tags — not expected in practice for
    // %D output, but the parser shouldn't throw on it.
    expect(parseRefDecorations("refs/bisect/bad")).toEqual([
      { type: "branch", name: "refs/bisect/bad", isHead: false },
    ]);
  });
});
