import { useState, type MouseEvent } from "react";
import { showToast } from "../design-system/toast";

interface Props {
  value: string;
  display?: string;
  className?: string;
  title?: string;
  /** Set false to let the click also reach the parent's own handler (e.g. a
   * row select or an expand toggle) instead of only copying. Defaults to true. */
  stopPropagation?: boolean;
}

/** Click-to-copy span, with a brief "Copied!" flash. */
export default function CopyableText({ value, display, className, title, stopPropagation = true }: Props) {
  const [copied, setCopied] = useState(false);

  function handleClick(e: MouseEvent) {
    if (stopPropagation) e.stopPropagation();
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => {
        // Clipboard access refused (permission denied, or a non-secure-context page) — previously
        // failed silently with no feedback at all.
        showToast("Couldn't copy to clipboard.");
      });
  }

  return (
    <span className={className} title={copied ? "Copied!" : (title ?? `Click to copy: ${value}`)} onClick={handleClick}>
      {copied ? "Copied!" : (display ?? value)}
    </span>
  );
}
