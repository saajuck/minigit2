import { describe, expect, it } from "vitest";
import { parseHotspotLog } from "./hotspot";

describe("parseHotspotLog", () => {
  it("counts commits and unique authors by email", () => {
    const output = "alice@example.com\nbob@example.com\nalice@example.com\n";
    expect(parseHotspotLog(output)).toEqual({ commits: 3, authors: 2 });
  });

  it("returns zero for a file with no history", () => {
    expect(parseHotspotLog("")).toEqual({ commits: 0, authors: 0 });
  });

  it("ignores blank lines", () => {
    const output = "alice@example.com\n\nalice@example.com\n";
    expect(parseHotspotLog(output)).toEqual({ commits: 2, authors: 1 });
  });
});
