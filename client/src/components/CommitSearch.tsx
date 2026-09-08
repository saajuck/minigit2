import { useRef } from "react";
import type { FormEvent } from "react";
import { XIcon } from "../design-system/icons";

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
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onNext();
  }

  /** Same path as deleting the text by hand — an empty query is what clears the highlights and
   * resets the match cursor upstream — with focus put back so typing a new query continues
   * straight from the box. */
  function clearQuery() {
    onQueryChange("");
    inputRef.current?.focus();
  }

  const hasQuery = query.trim().length > 0;

  return (
    <form className="commit-search" onSubmit={handleSubmit}>
      <div className="commit-search-field">
        <input
          ref={inputRef}
          className="input"
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && query.length > 0) {
              e.preventDefault();
              clearQuery();
            }
          }}
          placeholder="Search, or author:/after:/before:/file:/branch:…"
          title="Operators: author:name after:YYYY-MM-DD before:YYYY-MM-DD file:path branch:name — combinable, e.g. author:alice file:src/auth after:2026-01-01"
        />
        {query.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-icon commit-search-clear"
            title="Clear search (Esc)"
            aria-label="Clear search"
            onClick={clearQuery}
          >
            <XIcon />
          </button>
        )}
      </div>
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
