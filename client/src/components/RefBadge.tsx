import type { MouseEvent } from "react";
import type { RefDecoration } from "@minigit2/shared";

interface Props {
  decoration: RefDecoration;
  onCheckoutBranch?: (name: string) => void;
}

export default function RefBadge({ decoration, onCheckoutBranch }: Props) {
  function handleDoubleClick(e: MouseEvent) {
    if (decoration.type === "branch" && onCheckoutBranch) {
      e.stopPropagation();
      onCheckoutBranch(decoration.name);
    }
  }

  return (
    <span
      className={`ref-badge ref-${decoration.type}${decoration.isHead ? " head" : ""}`}
      title={decoration.name}
      onDoubleClick={handleDoubleClick}
    >
      {decoration.isHead ? "★ " : ""}
      {decoration.name}
    </span>
  );
}
