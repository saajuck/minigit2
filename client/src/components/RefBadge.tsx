import type { RefDecoration } from "@minigit2/shared";

interface Props {
  decoration: RefDecoration;
}

export default function RefBadge({ decoration }: Props) {
  return (
    <span className={`ref-badge ref-${decoration.type}${decoration.isHead ? " head" : ""}`} title={decoration.name}>
      {decoration.isHead ? "★ " : ""}
      {decoration.name}
    </span>
  );
}
