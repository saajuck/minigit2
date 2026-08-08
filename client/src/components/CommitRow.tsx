import type { CommitNode } from "@minigit2/shared";
import RefBadge from "./RefBadge";

interface Props {
  node: CommitNode;
  height: number;
  selected: boolean;
  onSelect: () => void;
}

export default function CommitRow({ node, height, selected, onSelect }: Props) {
  return (
    <div className={`commit-row${selected ? " selected" : ""}`} style={{ height }} onClick={onSelect}>
      <span className="hash">{node.hash.slice(0, 7)}</span>
      {node.refs.map((ref) => (
        <RefBadge key={`${ref.type}:${ref.name}`} decoration={ref} />
      ))}
      <span className="subject">{node.subject}</span>
      <span className="author">{node.author}</span>
      <span className="date">{new Date(node.date).toLocaleString()}</span>
    </div>
  );
}
