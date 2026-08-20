import type { MouseEvent, ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  /** The wider, list/browser-style dialog sizing (`.browser-dialog`) used by dialogs whose body
   * is a scrollable list rather than a form — matches how each dialog already opted into it
   * before this was factored out. */
  wide?: boolean;
  children: ReactNode;
}

/** Shared backdrop/box/title shell — every dialog in the app (Reflog, Stash, Branches, the repo
 * path browser, the checkout confirmation, add-repo) rendered this exact wrapper independently. */
export default function Dialog({ title, onClose, wide, children }: Props) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className={wide ? "dialog browser-dialog" : "dialog"} onClick={(e: MouseEvent) => e.stopPropagation()}>
        <div className="dialog-title">{title}</div>
        {children}
      </div>
    </div>
  );
}
