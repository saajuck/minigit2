import { describe, expect, it } from "vitest";
import { parseNameStatus, parseNumstat } from "./diff";

describe("parseNameStatus", () => {
  it("parses an added file", () => {
    expect(parseNameStatus("A\0src/new.ts\0")).toEqual([{ path: "src/new.ts", status: "added" }]);
  });

  it("parses a deleted file", () => {
    expect(parseNameStatus("D\0src/old.ts\0")).toEqual([{ path: "src/old.ts", status: "deleted" }]);
  });

  it("parses a modified file", () => {
    expect(parseNameStatus("M\0src/existing.ts\0")).toEqual([{ path: "src/existing.ts", status: "modified" }]);
  });

  it("parses a rename, keeping both the old and new path", () => {
    // git's real `-z --name-status` rename records carry a similarity percentage suffix on the
    // code (e.g. "R100"), not a bare "R", and emit old/new as two separate NUL-terminated fields
    // rather than git's default `old => new` abbreviation.
    expect(parseNameStatus("R100\0src/old.ts\0src/new.ts\0")).toEqual([
      { path: "src/new.ts", oldPath: "src/old.ts", status: "renamed" },
    ]);
  });

  it("parses multiple records", () => {
    const output = "A\0src/new.ts\0M\0src/existing.ts\0D\0src/old.ts\0";
    expect(parseNameStatus(output)).toEqual([
      { path: "src/new.ts", status: "added" },
      { path: "src/existing.ts", status: "modified" },
      { path: "src/old.ts", status: "deleted" },
    ]);
  });

  it("leaves a non-ASCII path unmangled, unlike git's default C-quoting without -z", () => {
    expect(parseNameStatus("M\0café.txt\0")).toEqual([{ path: "café.txt", status: "modified" }]);
  });

  it("returns an empty list for empty input", () => {
    expect(parseNameStatus("")).toEqual([]);
  });
});

describe("parseNumstat", () => {
  it("parses a plain added/modified file", () => {
    const output = "1\t0\tsrc/core/parser.ts\x00";
    expect(parseNumstat(output)).toEqual([{ path: "src/core/parser.ts", additions: 1, deletions: 0 }]);
  });

  it("parses multiple records", () => {
    const output = "1\t0\tsrc/core/parser.ts\x003\t2\tsrc/api/client.ts\x00";
    expect(parseNumstat(output)).toEqual([
      { path: "src/core/parser.ts", additions: 1, deletions: 0 },
      { path: "src/api/client.ts", additions: 3, deletions: 2 },
    ]);
  });

  it("resolves a rename to its new path, captured verbatim from `git diff -z --numstat`", () => {
    // Real output: the stat header has an empty trailing path, then old path, then new path —
    // NOT git's usual `{old => new}` abbreviation, which elides shared prefixes/suffixes in a
    // way that can't be safely turned back into a real path.
    const output = "1\t0\t\x00src/api/client.ts\x00src/api/http.ts\x001\t0\tsrc/core/parser.ts\x00";
    expect(parseNumstat(output)).toEqual([
      { path: "src/api/http.ts", additions: 1, deletions: 0 },
      { path: "src/core/parser.ts", additions: 1, deletions: 0 },
    ]);
  });

  it("treats a binary file's '-' counts as zero", () => {
    const output = "-\t-\tbin.dat\x00";
    expect(parseNumstat(output)).toEqual([{ path: "bin.dat", additions: 0, deletions: 0 }]);
  });

  it("returns an empty list for empty input", () => {
    expect(parseNumstat("")).toEqual([]);
  });
});
