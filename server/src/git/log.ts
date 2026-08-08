import type { RefDecoration } from "@minigit2/shared";
import { runGit } from "./exec";

const FIELD_SEP = "\x1f";
const RECORD_SEP = "\x1e";

export interface RawCommit {
  hash: string;
  parents: string[];
  author: string;
  authorEmail: string;
  date: string;
  subject: string;
  refs: RefDecoration[];
}

const UNBORN_BRANCH_MARKERS = ["does not have any commits yet", "bad default revision 'HEAD'"];

export async function getCommitLog(repoPath: string): Promise<RawCommit[]> {
  let stdout: string;
  try {
    const result = await runGit(repoPath, [
      "log",
      "--all",
      "--topo-order",
      "--decorate=full",
      "--date=iso-strict",
      `--pretty=format:%H${FIELD_SEP}%P${FIELD_SEP}%an${FIELD_SEP}%ae${FIELD_SEP}%ad${FIELD_SEP}%s${FIELD_SEP}%D${RECORD_SEP}`,
    ]);
    stdout = result.stdout;
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr ?? "";
    if (UNBORN_BRANCH_MARKERS.some((marker) => stderr.includes(marker))) {
      return [];
    }
    throw err;
  }

  return stdout
    .split(RECORD_SEP)
    .map((record) => record.replace(/^\n/, "").trim())
    .filter((record) => record.length > 0)
    .map(parseRecord);
}

function parseRecord(record: string): RawCommit {
  const [hash, parentsRaw, author, authorEmail, date, subject, decorations] = record.split(FIELD_SEP) as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const parents = parentsRaw ? parentsRaw.split(" ").filter(Boolean) : [];
  return {
    hash,
    parents,
    author,
    authorEmail,
    date,
    subject,
    refs: parseRefDecorations(decorations ?? ""),
  };
}

/** Parses the %D output of `git log --decorate=full`, e.g. "HEAD -> refs/heads/main, tag: refs/tags/v1.0". */
function parseRefDecorations(raw: string): RefDecoration[] {
  if (!raw.trim()) return [];

  return raw
    .split(", ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      let isHead = false;
      let name = part;

      if (name.startsWith("HEAD -> ")) {
        isHead = true;
        name = name.slice("HEAD -> ".length);
      } else if (name === "HEAD") {
        return { type: "branch" as const, name: "HEAD", isHead: true };
      }

      if (name.startsWith("tag: ")) {
        name = name.slice("tag: ".length);
      }

      if (name.startsWith("refs/heads/")) {
        return { type: "branch" as const, name: name.slice("refs/heads/".length), isHead };
      }
      if (name.startsWith("refs/remotes/")) {
        return { type: "remote" as const, name: name.slice("refs/remotes/".length), isHead };
      }
      if (name.startsWith("refs/tags/")) {
        return { type: "tag" as const, name: name.slice("refs/tags/".length), isHead };
      }
      return { type: "branch" as const, name, isHead };
    });
}
