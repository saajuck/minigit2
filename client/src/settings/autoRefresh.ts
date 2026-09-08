import { useEffect, useState } from "react";

const AUTO_REFRESH_KEY = "minigit2:autoRefreshMs";

export const DEFAULT_AUTO_REFRESH_MS = 30_000;

/** The interval choices offered in Settings — a fixed list rather than a free-form number field
 * so the value can't be set low enough to keep a `git fetch` permanently in flight. */
export const AUTO_REFRESH_OPTIONS: { ms: number; label: string }[] = [
  { ms: 10_000, label: "10 seconds" },
  { ms: 30_000, label: "30 seconds" },
  { ms: 60_000, label: "1 minute" },
  { ms: 120_000, label: "2 minutes" },
  { ms: 300_000, label: "5 minutes" },
];

/** Falls back to the default for anything that isn't one of the offered values — an absent key
 * (first run), but also a stale value left by an older build whose option list differed. */
export function parseAutoRefreshInterval(stored: string | null): number {
  const ms = Number(stored);
  return AUTO_REFRESH_OPTIONS.some((o) => o.ms === ms) ? ms : DEFAULT_AUTO_REFRESH_MS;
}

/** Short form for tooltips/help text ("30s", "5 min"), as opposed to the option labels above. */
export function formatAutoRefreshInterval(ms: number): string {
  return ms < 60_000 ? `${ms / 1000}s` : `${ms / 60_000} min`;
}

export function useAutoRefreshInterval(): [number, (ms: number) => void] {
  const [intervalMs, setIntervalMs] = useState<number>(() =>
    parseAutoRefreshInterval(localStorage.getItem(AUTO_REFRESH_KEY)),
  );

  useEffect(() => {
    localStorage.setItem(AUTO_REFRESH_KEY, String(intervalMs));
  }, [intervalMs]);

  return [intervalMs, setIntervalMs];
}
