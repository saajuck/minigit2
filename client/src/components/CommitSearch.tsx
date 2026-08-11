import type { FormEvent } from "react";

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  matchCount: number;
  /** True while a `file:` filter's server lookup is still in flight — match count would
   * otherwise flash "0 matches" for the debounce window before results resolve. */
  loading: boolean;
  onNext: () => void;
  onPrev: () => void;
}

export default function CommitSearch({ query, onQueryChange, matchCount, loading, onNext, onPrev }: Props) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onNext();
  }

  const hasQuery = query.trim().length > 0;

  return (
    <form className="commit-search" onSubmit={handleSubmit}>
      <input
        className="input"
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search, or author:/after:/before:/file:/branch:…"
        title="Operators: author:name after:YYYY-MM-DD before:YYYY-MM-DD file:path branch:name — combinable, e.g. author:alice file:src/auth after:2026-01-01"
      />
      {hasQuery && loading && <span className="commit-search-count muted">Searching files…</span>}
      {hasQuery && !loading && (
        <span className="commit-search-count muted">
          {matchCount} match{matchCount === 1 ? "" : "es"}
        </span>
      )}
      {hasQuery && matchCount > 0 && (
        <>
          <button type="button" className="btn btn-ghost btn-icon" title="Previous match" onClick={onPrev}>
            ↑
          </button>
          <button type="submit" className="btn btn-ghost btn-icon" title="Next match (Enter)">
            ↓
          </button>
        </>
      )}
    </form>
  );
}
