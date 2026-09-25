import { describe, expect, it } from "vitest";
import { parseTags } from "./tags";

const SEP = "\x1f";
const line = (...fields: string[]) => fields.join(SEP);

describe("parseTags", () => {
  it("returns nothing for an empty listing", () => {
    expect(parseTags("")).toEqual([]);
    expect(parseTags("\n  \n")).toEqual([]);
  });

  it("resolves an annotated tag to its peeled commit, keeping its own message", () => {
    const out = line("v1.0.0", "7a7a7a7", "c0mm1t0", "2026-01-02T03:04:05+00:00", "Release 1.0.0", "the commit subject");
    expect(parseTags(out)).toEqual([
      {
        name: "v1.0.0",
        hash: "c0mm1t0",
        date: "2026-01-02T03:04:05+00:00",
        subject: "Release 1.0.0",
        annotated: true,
      },
    ]);
  });

  it("uses the commit itself for a lightweight tag, which has no peeled target or message", () => {
    const out = line("v0.9", "c0mm1t1", "", "2026-01-01T00:00:00+00:00", "", "fix: the commit subject");
    expect(parseTags(out)).toEqual([
      {
        name: "v0.9",
        hash: "c0mm1t1",
        date: "2026-01-01T00:00:00+00:00",
        subject: "fix: the commit subject",
        annotated: false,
      },
    ]);
  });

  it("keeps a tag whose subject is empty on both sides rather than dropping the row", () => {
    expect(parseTags(line("bare", "c0mm1t2", "", "2026-01-01T00:00:00+00:00", "", ""))).toEqual([
      { name: "bare", hash: "c0mm1t2", date: "2026-01-01T00:00:00+00:00", subject: "", annotated: false },
    ]);
  });

  it("parses several tags, preserving git's own ordering", () => {
    const out = [
      line("v2", "a2", "", "2026-02-01T00:00:00+00:00", "", "second"),
      line("v1", "a1", "", "2026-01-01T00:00:00+00:00", "", "first"),
    ].join("\n");
    expect(parseTags(out).map((t) => t.name)).toEqual(["v2", "v1"]);
  });
});
