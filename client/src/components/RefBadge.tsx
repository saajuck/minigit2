import type { MouseEvent } from "react";
import type { RefDecoration } from "@minigit2/shared";
import { getPalette, type Theme } from "../design-system/palette";

interface Props {
  decoration: RefDecoration;
  theme: Theme;
  onCheckoutRef: (ref: string) => void;
}

export default function RefBadge({ decoration, theme, onCheckoutRef }: Props) {
  const pal = getPalette(theme);

  function handleDoubleClick(e: MouseEvent) {
    e.stopPropagation();
    onCheckoutRef(decoration.name);
  }

  const style =
    decoration.type === "remote"
      ? undefined
      : {
          background: decoration.type === "branch" ? pal[0]!.bg : pal[2]!.bg,
          color: decoration.type === "branch" ? pal[0]!.text : pal[2]!.text,
          fontWeight: decoration.type === "branch" && decoration.isHead ? 600 : undefined,
        };

  return (
    <span
      className={`tag ref-badge${decoration.type === "remote" ? " tag-neutral" : ""}`}
      style={style}
      title={decoration.name}
      onDoubleClick={handleDoubleClick}
    >
      {decoration.name}
    </span>
  );
}
