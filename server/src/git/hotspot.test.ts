import { describe, expect, it } from "vitest";
import { parseHotspotLog } from "./hotspot";

const DELIM = "\x01";

describe("parseHotspotLog", () => {
  it("counts commits and unique authors per requested path, from a single combined log", () => {
    const output =
      `${DELIM}alice@example.com\0\na.ts\0b.ts\0` +
      `${DELIM}bob@example.com\0\na.ts\0` +
      `${DELIM}alice@example.com\0\na.ts\0`;
    expect(parseHotspotLog(output, new Set(["a.ts", "b.ts"]))).toEqual({
      "a.ts": { commits: 3, authors: 2 },
      "b.ts": { commits: 1, authors: 1 },
    });
  });

  it("returns zero for a requested path with no history", () => {
    const output = `${DELIM}alice@example.com\0\nother.ts\0`;
    expect(parseHotspotLog(output, new Set(["missing.ts"]))).toEqual({
      "missing.ts": { commits: 0, authors: 0 },
    });
  });

  it("ignores files not in the requested set", () => {
    const output = `${DELIM}alice@example.com\0\nwanted.ts\0unwanted.ts\0`;
    expect(parseHotspotLog(output, new Set(["wanted.ts"]))).toEqual({
      "wanted.ts": { commits: 1, authors: 1 },
    });
  });

  it("handles a merge commit with no changed files (no trailing newline at all under -z)", () => {
    const output = `${DELIM}alice@example.com\0` + `${DELIM}bob@example.com\0\na.ts\0`;
    expect(parseHotspotLog(output, new Set(["a.ts"]))).toEqual({
      "a.ts": { commits: 1, authors: 1 },
    });
  });

  it("matches a non-ASCII path, unmangled thanks to -z (no C-quoting)", () => {
    const output = `${DELIM}alice@example.com\0\ncafé.txt\0`;
    expect(parseHotspotLog(output, new Set(["café.txt"]))).toEqual({
      "café.txt": { commits: 1, authors: 1 },
    });
  });

  it("returns an empty object for an empty requested set", () => {
    expect(parseHotspotLog("", new Set())).toEqual({});
  });
});
