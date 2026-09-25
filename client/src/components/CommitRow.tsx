import { memo, type MouseEvent } from "react";
import type { CommitNode } from "@minigit2/shared";
import type { Theme } from "../design-system/palette";
import CopyableText from "./CopyableText";
import RefBadge from "./RefBadge";

interface Props {
  node: CommitNode;
  height: number;
  theme: Theme;
  selected: boolean;
  compared: boolean;
  dimmed: boolean;
  /** Take the hash rather than closing over it in the parent: a fresh arrow function per row per
   * render would defeat the memo below, which is the whole point of it. */
  onSelect: (hash: string) => void;
  onCompareClick: (hash: string) => void;
  onCheckoutRef: (ref: string) => void;
}

function CommitRow({
  node,
  height,
  theme,
  selected,
  compared,
  dimmed,
  onSelect,
  onCompareClick,
  onCheckoutRef,
}: Props) {
  const authorTitle = `${node.author} <${node.authorEmail}>`;

  function handleClick(e: MouseEvent) {
    if (e.metaKey || e.ctrlKey) {
      onCompareClick(node.hash);
    } else {
      onSelect(node.hash);
    }
  }

  return (
    <div
      className={`commit-row${selected ? " selected" : ""}${compared ? " compared" : ""}${dimmed ? " dimmed" : ""}`}
      style={{ height }}
      onClick={handleClick}
      onDoubleClick={() => onCheckoutRef(node.hash)}
    >
      <CopyableText className="commit-hash" value={node.hash} display={node.hash.slice(0, 7)} />
      {node.refs.map((ref) => (
        <RefBadge key={`${ref.type}:${ref.name}`} decoration={ref} theme={theme} onCheckoutRef={onCheckoutRef} />
      ))}
      <span className="commit-subject">{node.subject}</span>
      {/* The row truncates the author to fit, and the avatar says nothing on its own — both carry
          the full identity on hover so a "Dev 12" or an initials-only gravatar can be resolved
          without opening the commit. */}
      <img className="commit-avatar" src={node.authorAvatarUrl} alt="" loading="lazy" title={authorTitle} />
      <span className="commit-author" title={authorTitle}>
        {node.author}
      </span>
      <span className="commit-date" title={node.date}>
        {formatDate(node.date)}
      </span>
    </div>
  );
}

/** Scrolling re-renders the graph on every frame, but most of the rows on screen are the same
 * ones as the frame before with identical props — re-rendering their hash/badges/avatar/date
 * subtree each time is pure waste. Memoised on that basis; it only holds because every callback
 * prop above is stable across renders (see onSelect's note). */
export default memo(CommitRow);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
