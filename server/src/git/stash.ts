import type { StashEntry } from "@minigit2/shared";
import { runGit } from "./exec";

const FIELD_SEP = "\x1f";
const RECORD_SEP = "\x1e";

export async function getStashList(repoPath: string): Promise<StashEntry[]> {
  const { stdout } = await runGit(repoPath, [
    "stash",
    "list",
    `--pretty=format:%gd${FIELD_SEP}%H${FIELD_SEP}%s${FIELD_SEP}%ai${RECORD_SEP}`,
  ]);

  return stdout
    .split(RECORD_SEP)
    .map((record) => record.replace(/^\n/, "").trim())
    .filter((record) => record.length > 0)
    .map((record) => {
      const [ref, hash, subject, date] = record.split(FIELD_SEP) as [string, string, string, string];
      return { ref, hash, subject, date };
    });
}
