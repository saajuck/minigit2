import type { ReflogEntry } from "@minigit2/shared";
import { runGit } from "./exec";

const FIELD_SEP = "\x1f";
const RECORD_SEP = "\x1e";

export async function getReflog(repoPath: string): Promise<ReflogEntry[]> {
  let stdout: string;
  try {
    const result = await runGit(repoPath, [
      "reflog",
      "show",
      "HEAD",
      `--pretty=format:%h${FIELD_SEP}%H${FIELD_SEP}%gs${FIELD_SEP}%ai${RECORD_SEP}`,
    ]);
    stdout = result.stdout;
  } catch {
    return []; // unborn branch, or no reflog yet
  }

  return stdout
    .split(RECORD_SEP)
    .map((record) => record.replace(/^\n/, "").trim())
    .filter((record) => record.length > 0)
    .map((record) => {
      const [shortHash, hash, action, date] = record.split(FIELD_SEP) as [string, string, string, string];
      return { shortHash, hash, action, date };
    });
}
