import { describe, expect, it } from "vitest";
import { parsePorcelainBlame } from "./blame";

// Captured verbatim from a real `git blame --porcelain` run: three commits touching a 5-line
// file — sha e6f... is a "boundary" (root) commit reused later in compact form (line 3), sha
// 3ca0... likewise reused (line 4), sha 1bc3... appears once. Covers: full metadata block,
// compact repeat, and the `boundary` line (an unknown key the parser must skip over, not choke on).
const PORCELAIN_FIXTURE = [
  "e6f344e0b402f05492c4128c6fc6a259e9e18169 1 1 1",
  "author Alice",
  "author-mail <a@example.com>",
  "author-time 1786298695",
  "author-tz +0000",
  "committer Alice",
  "committer-mail <a@example.com>",
  "committer-time 1786298695",
  "committer-tz +0000",
  "summary first commit",
  "boundary",
  "filename f.txt",
  "\tline1",
  "3ca0be4b09cc4113011c04b18b9d2f86609155dc 2 2 1",
  "author Bob",
  "author-mail <b@example.com>",
  "author-time 1786298700",
  "author-tz +0000",
  "committer Bob",
  "committer-mail <b@example.com>",
  "committer-time 1786298700",
  "committer-tz +0000",
  "summary second commit",
  "previous e6f344e0b402f05492c4128c6fc6a259e9e18169 f.txt",
  "filename f.txt",
  "\tline2 edited",
  "e6f344e0b402f05492c4128c6fc6a259e9e18169 3 3 1",
  "\tline3",
  "3ca0be4b09cc4113011c04b18b9d2f86609155dc 4 4 1",
  "\tline4",
  "1bc3795564dc8a224595bdba180a511b1a483545 5 5 1",
  "author Alice",
  "author-mail <a@example.com>",
  "author-time 1786298710",
  "author-tz +0000",
  "committer Alice",
  "committer-mail <a@example.com>",
  "committer-time 1786298710",
  "committer-tz +0000",
  "summary third commit",
  "previous 3ca0be4b09cc4113011c04b18b9d2f86609155dc f.txt",
  "filename f.txt",
  "\tline5",
].join("\n");

describe("parsePorcelainBlame", () => {
  it("parses full metadata blocks, compact repeats, and unknown keys (boundary/previous) without desyncing", () => {
    const lines = parsePorcelainBlame(PORCELAIN_FIXTURE);

    expect(lines).toHaveLength(5);
    expect(lines.map((l) => l.content)).toEqual(["line1", "line2 edited", "line3", "line4", "line5"]);
    expect(lines.map((l) => l.lineNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it("carries full author metadata on both the first appearance and later compact repeats of a commit", () => {
    const lines = parsePorcelainBlame(PORCELAIN_FIXTURE);

    // line1 (first appearance) and line3 (compact repeat, no metadata block) share the same commit.
    expect(lines[0]).toMatchObject({
      hash: "e6f344e0b402f05492c4128c6fc6a259e9e18169",
      author: "Alice",
      authorEmail: "a@example.com",
      summary: "first commit",
    });
    expect(lines[2]).toMatchObject({
      hash: "e6f344e0b402f05492c4128c6fc6a259e9e18169",
      author: "Alice",
      authorEmail: "a@example.com",
      summary: "first commit",
    });
  });

  it("converts author-time (unix epoch seconds) to an ISO date", () => {
    const lines = parsePorcelainBlame(PORCELAIN_FIXTURE);
    expect(lines[0]!.date).toBe(new Date(1786298695 * 1000).toISOString());
  });

  it("derives a gravatar URL from the author email", () => {
    const lines = parsePorcelainBlame(PORCELAIN_FIXTURE);
    expect(lines[0]!.authorAvatarUrl).toContain("gravatar.com/avatar/");
  });

  it("returns an empty list for empty input", () => {
    expect(parsePorcelainBlame("")).toEqual([]);
  });
});
