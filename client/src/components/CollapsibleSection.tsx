import { useState, type ReactNode } from "react";
import { ChevronRightIcon } from "../design-system/icons";

interface Props {
  title: ReactNode;
  /** Uncontrolled — each section tracks its own open state from mount. Callers that need the
   * initial state to react to their own data (e.g. "collapsed only when there's a lot of
   * content") pass a fresh `key` to remount instead of trying to control this from outside. */
  defaultOpen?: boolean;
  children: ReactNode;
}

/** Generic collapsible block — a clickable header with a rotating chevron, same visual language
 * as FileDiff's own header and the entry-list dialogs' expandable rows. Used in DiffPanel to let
 * a long commit message or the hotspot stats get out of the way without permanently losing them,
 * rather than always claiming vertical space whether or not they're the reason someone opened
 * this diff. */
export default function CollapsibleSection({ title, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="collapsible-section">
      <button type="button" className="collapsible-section-header" onClick={() => setOpen((o) => !o)}>
        <span className="collapsible-section-chevron" style={{ transform: `rotate(${open ? 90 : 0}deg)` }}>
          <ChevronRightIcon />
        </span>
        {title}
      </button>
      {open && <div className="collapsible-section-body">{children}</div>}
    </div>
  );
}
