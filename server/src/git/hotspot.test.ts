import { describe, expect, it } from "vitest";
import { parseHotspotLog } from "./hotspot";

const DELIM = "\x01";

describe("parseHotspotLog", () => {
  it("counts commits and unique authors per requested path, from a single combined log", () => {
    const output =
      `${DELIM}alice@example.com\n\na.ts\nb.ts\n` +
      `${DELIM}bob@example.com\n\na.ts\n` +
      `${DELIM}alice@example.com\n\na.ts\n`;
    expect(parseHotspotLog(output, new Set(["a.ts", "b.ts"]))).toEqual({
      "a.ts": { commits: 3, authors: 2 },
      "b.ts": { commits: 1, authors: 1 },
    });
  });

  it("returns zero for a requested path with no history", () => {
    const output = `${DELIM}alice@example.com\n\nother.ts\n`;
    expect(parseHotspotLog(output, new Set(["missing.ts"]))).toEqual({
      "missing.ts": { commits: 0, authors: 0 },
    });
  });

  it("ignores files not in the requested set", () => {
    const output = `${DELIM}alice@example.com\n\nwanted.ts\nunwanted.ts\n`;
    expect(parseHotspotLog(output, new Set(["wanted.ts"]))).toEqual({
      "wanted.ts": { commits: 1, authors: 1 },
    });
  });

  it("handles a merge commit with no changed files (no blank-line file list)", () => {
    const output = `${DELIM}alice@example.com\n` + `${DELIM}bob@example.com\n\na.ts\n`;
    expect(parseHotspotLog(output, new Set(["a.ts"]))).toEqual({
      "a.ts": { commits: 1, authors: 1 },
    });
  });

  it("returns an empty object for an empty requested set", () => {
    expect(parseHotspotLog("", new Set())).toEqual({});
  });
});
