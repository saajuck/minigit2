import type { ReactNode } from "react";
import { deriveMergeRequestUrl } from "./remoteUrl";

// Group 1: a bare URL, verbatim from the message. Group 2: a GitLab merge-request reference's
// id — GitLab's own convention (auto-appended as "See merge request <namespace>!<id>") puts the
// "!" directly against the namespace with no space before it, so this deliberately doesn't
// require a word boundary/whitespace before "!" the way it might for a "safer" pattern.
const LINK_PATTERN = /(https?:\/\/[^\s)"'<>]+)|!(\d+)\b/g;

/** Turns bare URLs and GitLab `!123` merge-request references inside a commit message into
 * clickable links, everything else left as plain text — returns React nodes (not an HTML
 * string) so there's no dangerouslySetInnerHTML risk from commit message content, which is
 * arbitrary text any contributor could have written. */
export function linkifyMessage(text: string, remoteUrl: string | null): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = LINK_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const [full, url, mrId] = match;
    if (url) {
      nodes.push(
        <a key={key++} href={url} target="_blank" rel="noreferrer">
          {url}
        </a>,
      );
    } else if (mrId) {
      const mrUrl = remoteUrl ? deriveMergeRequestUrl(remoteUrl, mrId) : null;
      nodes.push(
        mrUrl ? (
          <a key={key++} href={mrUrl} target="_blank" rel="noreferrer">
            {full}
          </a>
        ) : (
          full
        ),
      );
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}
