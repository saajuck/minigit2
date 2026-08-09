import type { CommitNode } from "@minigit2/shared";
import type { Theme } from "../design-system/palette";
import RefBadge from "./RefBadge";

interface Props {
  node: CommitNode;
  height: number;
  theme: Theme;
  selected: boolean;
  onSelect: () => void;
  onCheckoutRef: (ref: string) => void;
}

export default function CommitRow({ node, height, theme, selected, onSelect, onCheckoutRef }: Props) {
  return (
    <div
      className={`commit-row${selected ? " selected" : ""}`}
      style={{ height }}
      onClick={onSelect}
      onDoubleClick={() => onCheckoutRef(node.hash)}
    >
      <span className="commit-hash">{node.hash.slice(0, 7)}</span>
      <span className="commit-subject">{node.subject}</span>
      {node.refs.map((ref) => (
        <RefBadge key={`${ref.type}:${ref.name}`} decoration={ref} theme={theme} onCheckoutRef={onCheckoutRef} />
      ))}
      <span className="commit-author">{node.author}</span>
      <span className="commit-date" title={node.date}>
        {formatDate(node.date)}
      </span>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
