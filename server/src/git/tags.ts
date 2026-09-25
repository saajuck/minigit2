import type { TagInfo, TagsResponse } from "@minigit2/shared";
import { runGit } from "./exec";

const SEP = "\x1f";

/** Every tag in the repo, newest first. `creatordate` rather than `refname` ordering: this list
 * exists to jump around a history, and "what was released recently" is the question it usually
 * answers — version-name ordering would also mis-sort any scheme that isn't strictly numeric. */
export async function getTags(repoPath: string): Promise<TagsResponse> {
  const { stdout } = await runGit(repoPath, [
    "for-each-ref",
    "refs/tags",
    "--sort=-creatordate",
    // `*objectname`/`*subject` are the *peeled* target's fields, non-empty only for an annotated
    // tag; a lightweight tag points straight at the commit, so its own objectname already is it.
    `--format=%(refname:short)${SEP}%(objectname)${SEP}%(*objectname)${SEP}%(creatordate:iso-strict)${SEP}%(contents:subject)${SEP}%(*subject)`,
  ]);
  return { tags: parseTags(stdout) };
}

export function parseTags(stdout: string): TagInfo[] {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, objectName, peeled, date, subject, peeledSubject] = line.split(SEP) as [
        string,
        string,
        string,
        string,
        string,
        string,
      ];
      const annotated = Boolean(peeled);
      return {
        name,
        hash: annotated ? peeled : objectName,
        date,
        // An annotated tag carries its own message; a lightweight one has none, so fall back to
        // what the commit it points at says — an empty line in the list would just be noise.
        subject: (annotated ? subject : peeledSubject || subject) || "",
        annotated,
      };
    });
}
