import type { MouseEvent } from "react";
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
  onSelect: () => void;
  onCompareClick: () => void;
  onCheckoutRef: (ref: string) => void;
}

export default function CommitRow({
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
      onCompareClick();
    } else {
      onSelect();
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
