import { describe, expect, it } from "vitest";
import {
  AUTO_REFRESH_OPTIONS,
  DEFAULT_AUTO_REFRESH_MS,
  formatAutoRefreshInterval,
  parseAutoRefreshInterval,
} from "./autoRefresh";

describe("parseAutoRefreshInterval", () => {
  it("keeps a stored value that is one of the offered options", () => {
    expect(parseAutoRefreshInterval("300000")).toBe(300_000);
  });

  it("falls back to the default when nothing is stored", () => {
    expect(parseAutoRefreshInterval(null)).toBe(DEFAULT_AUTO_REFRESH_MS);
  });

  it("falls back to the default for junk or an option that no longer exists", () => {
    expect(parseAutoRefreshInterval("not a number")).toBe(DEFAULT_AUTO_REFRESH_MS);
    expect(parseAutoRefreshInterval("7500")).toBe(DEFAULT_AUTO_REFRESH_MS);
    expect(parseAutoRefreshInterval("0")).toBe(DEFAULT_AUTO_REFRESH_MS);
  });

  it("offers the default as one of the options", () => {
    expect(AUTO_REFRESH_OPTIONS.some((o) => o.ms === DEFAULT_AUTO_REFRESH_MS)).toBe(true);
  });
});

describe("formatAutoRefreshInterval", () => {
  it("uses seconds below a minute and minutes above it", () => {
    expect(formatAutoRefreshInterval(10_000)).toBe("10s");
    expect(formatAutoRefreshInterval(30_000)).toBe("30s");
    expect(formatAutoRefreshInterval(60_000)).toBe("1 min");
    expect(formatAutoRefreshInterval(300_000)).toBe("5 min");
  });
});
