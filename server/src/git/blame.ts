import type { BlameLine, BlameResponse } from "@minigit2/shared";
import { gravatarUrl } from "./gravatar";
import { runGit } from "./exec";

export async function getFileBlame(repoPath: string, ref: string, filePath: string): Promise<BlameResponse> {
  const { stdout } = await runGit(repoPath, ["blame", "--porcelain", ref, "--", filePath]);
  return { path: filePath, lines: parsePorcelainBlame(stdout) };
}

interface CommitMeta {
  author: string;
  authorEmail: string;
  authorTime: number;
  summary: string;
}

const HEADER_RE = /^([0-9a-f]{40}) (\d+) (\d+)(?: (\d+))?$/;

/**
 * Parses `git blame --porcelain` output. Each source line is preceded either by a full block
 * (sha's first appearance in the output: metadata lines follow, up to the tab-prefixed content
 * line) or a compact one (sha already seen: the content line follows immediately) — which form
 * appears is keyed on whether we've already read that sha's metadata, not on the group-size field
 * (present on the first line of a same-commit run either way, but not a reliable "first ever
 * appearance" signal on its own).
 */
export function parsePorcelainBlame(output: string): BlameLine[] {
  const rawLines = output.split("\n");
  const seen = new Map<string, CommitMeta>();
  const lines: BlameLine[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const headerLine = rawLines[i] ?? "";
    const match = headerLine.match(HEADER_RE);
    if (!match) {
      i++;
      continue;
    }
    const sha = match[1] as string;
    const finalLine = Number(match[3]);
    i++;

    if (!seen.has(sha)) {
      let author = "";
      let authorEmail = "";
      let authorTime = 0;
      let summary = "";
      while (i < rawLines.length && !(rawLines[i] ?? "").startsWith("\t")) {
        const line = rawLines[i] as string;
        const spaceIdx = line.indexOf(" ");
        const key = spaceIdx === -1 ? line : line.slice(0, spaceIdx);
        const value = spaceIdx === -1 ? "" : line.slice(spaceIdx + 1);
        switch (key) {
          case "author":
            author = value;
            break;
          case "author-mail":
            authorEmail = value.replace(/[<>]/g, "");
            break;
          case "author-time":
            authorTime = Number(value);
            break;
          case "summary":
            summary = value;
            break;
          default:
            break;
        }
        i++;
      }
      seen.set(sha, { author, authorEmail, authorTime, summary });
    }

    const contentLine = rawLines[i] ?? "";
    const content = contentLine.startsWith("\t") ? contentLine.slice(1) : contentLine;
    i++;

    const meta = seen.get(sha) as CommitMeta;
    lines.push({
      hash: sha,
      author: meta.author,
      authorEmail: meta.authorEmail,
      authorAvatarUrl: gravatarUrl(meta.authorEmail),
      date: new Date(meta.authorTime * 1000).toISOString(),
      summary: meta.summary,
      lineNumber: finalLine,
      content,
    });
  }

  return lines;
}
