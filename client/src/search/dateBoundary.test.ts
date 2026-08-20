import { describe, expect, it } from "vitest";
import { parseDateBoundary } from "./dateBoundary";

describe("parseDateBoundary", () => {
  it("parses a bare date's start boundary as local midnight, not UTC midnight", () => {
    const date = parseDateBoundary("2024-01-15", "start");
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2024);
    expect(date!.getMonth()).toBe(0);
    expect(date!.getDate()).toBe(15);
    expect(date!.getHours()).toBe(0);
    expect(date!.getMinutes()).toBe(0);
  });

  it("parses a bare date's end boundary as the last instant of that local day", () => {
    const date = parseDateBoundary("2024-01-15", "end");
    expect(date).not.toBeNull();
    expect(date!.getDate()).toBe(15);
    expect(date!.getHours()).toBe(23);
    expect(date!.getMinutes()).toBe(59);
    expect(date!.getSeconds()).toBe(59);
  });

  it("keeps a same-day after/before range covering the whole day", () => {
    const start = parseDateBoundary("2024-01-15", "start")!;
    const end = parseDateBoundary("2024-01-15", "end")!;
    // A commit made at any local time on Jan 15 falls within [start, end].
    const midday = new Date(2024, 0, 15, 12, 0, 0);
    expect(midday >= start && midday <= end).toBe(true);
  });

  it("falls back to a plain Date parse for a full timestamp", () => {
    const date = parseDateBoundary("2024-01-15T10:00:00Z", "start");
    expect(date).not.toBeNull();
    expect(date!.getTime()).toBe(new Date("2024-01-15T10:00:00Z").getTime());
  });

  it("returns null for an unparseable value", () => {
    expect(parseDateBoundary("not-a-date", "start")).toBeNull();
    expect(parseDateBoundary("", "end")).toBeNull();
  });
});
