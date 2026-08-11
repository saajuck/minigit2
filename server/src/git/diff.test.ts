import { describe, expect, it } from "vitest";
import { parseNumstat } from "./diff";

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
