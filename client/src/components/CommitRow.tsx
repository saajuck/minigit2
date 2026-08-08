import type { CommitNode } from "@minigit2/shared";
import RefBadge from "./RefBadge";

interface Props {
  node: CommitNode;
  height: number;
  selected: boolean;
  onSelect: () => void;
  onCheckoutCommit: () => void;
  onCheckoutBranch: (name: string) => void;
}

export default function CommitRow({ node, height, selected, onSelect, onCheckoutCommit, onCheckoutBranch }: Props) {
  return (
    <div
      className={`commit-row${selected ? " selected" : ""}`}
      style={{ height }}
      onClick={onSelect}
      onDoubleClick={onCheckoutCommit}
    >
      <span className="hash">{node.hash.slice(0, 7)}</span>
      {node.refs.map((ref) => (
        <RefBadge key={`${ref.type}:${ref.name}`} decoration={ref} onCheckoutBranch={onCheckoutBranch} />
      ))}
      <span className="subject">{node.subject}</span>
      <span className="author">{node.author}</span>
      <span className="date">{new Date(node.date).toLocaleString()}</span>
    </div>
  );
}
