import { useState, type MouseEvent } from "react";

interface Props {
  value: string;
  display?: string;
  className?: string;
  title?: string;
}

/** Click-to-copy span, with a brief "Copied!" flash. Stops propagation so it
 * doesn't also trigger whatever click handler its parent row/button has. */
export default function CopyableText({ value, display, className, title }: Props) {
  const [copied, setCopied] = useState(false);

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <span className={className} title={copied ? "Copied!" : (title ?? `Click to copy: ${value}`)} onClick={handleClick}>
      {copied ? "Copied!" : (display ?? value)}
    </span>
  );
}
