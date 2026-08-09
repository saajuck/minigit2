import type { FormEvent } from "react";

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  matchCount: number;
  onNext: () => void;
  onPrev: () => void;
}

export default function CommitSearch({ query, onQueryChange, matchCount, onNext, onPrev }: Props) {
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
        placeholder="Search commits (message, author, hash)…"
      />
      {hasQuery && (
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
