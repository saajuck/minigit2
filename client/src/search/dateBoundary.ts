/**
 * Parses an `after:`/`before:` search operator's value as the boundary of a *local* calendar day
 * for a bare `YYYY-MM-DD` value, instead of `new Date(str)`'s own interpretation of that exact
 * shape as UTC midnight (per the ISO 8601 date-only rule) — which meant `before:2024-01-15`
 * quietly excluded commits made on the evening of Jan 14 in any timezone west of UTC, since
 * `new Date("2024-01-15")` is midnight UTC, not midnight local. `boundary` selects which edge of
 * that local day to use: "start" (local midnight) for `after:`, "end" (the last instant of that
 * local day) for `before:`, so `after:2024-01-15 before:2024-01-15` still matches the whole day
 * rather than nothing. Falls back to a plain `new Date(value)` for anything that isn't a bare
 * date (a full ISO timestamp, say), returning `null` for an unparseable value either way.
 */
export function parseDateBoundary(value: string, boundary: "start" | "end"): Date | null {
  const trimmed = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const date =
      boundary === "start"
        ? new Date(year, month - 1, day, 0, 0, 0, 0)
        : new Date(year, month - 1, day, 23, 59, 59, 999);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
