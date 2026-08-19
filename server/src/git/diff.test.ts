import { describe, expect, it } from "vitest";
import { parseNameStatus, parseNumstat } from "./diff";

describe("parseNameStatus", () => {
  it("parses an added file", () => {
    expect(parseNameStatus("A\tsrc/new.ts")).toEqual([{ path: "src/new.ts", status: "added" }]);
  });

  it("parses a deleted file", () => {
    expect(parseNameStatus("D\tsrc/old.ts")).toEqual([{ path: "src/old.ts", status: "deleted" }]);
  });

  it("parses a modified file", () => {
    expect(parseNameStatus("M\tsrc/existing.ts")).toEqual([{ path: "src/existing.ts", status: "modified" }]);
  });

  it("parses a rename, keeping both the old and new path", () => {
    // git's real --name-status rename lines carry a similarity percentage suffix on the code
    // (e.g. "R100"), not a bare "R".
    expect(parseNameStatus("R100\tsrc/old.ts\tsrc/new.ts")).toEqual([
      { path: "src/new.ts", oldPath: "src/old.ts", status: "renamed" },
    ]);
  });

  it("parses multiple records", () => {
    const output = "A\tsrc/new.ts\nM\tsrc/existing.ts\nD\tsrc/old.ts";
    expect(parseNameStatus(output)).toEqual([
      { path: "src/new.ts", status: "added" },
      { path: "src/existing.ts", status: "modified" },
      { path: "src/old.ts", status: "deleted" },
    ]);
  });

  it("ignores blank lines", () => {
    expect(parseNameStatus("A\tsrc/new.ts\n\n")).toEqual([{ path: "src/new.ts", status: "added" }]);
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
