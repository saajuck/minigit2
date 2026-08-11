export interface ParsedQuery {
  /** Free-text terms, everything not recognized as a key:value operator, matched against
   * subject/author/hash exactly like the search box did before operators existed. */
  text: string;
  author: string | null;
  after: string | null;
  before: string | null;
  file: string | null;
  /** Multiple `branch:` tokens OR together (any of the named branches), same as typing several
   * branch badges into one filter would mean. */
  branches: string[];
}

const OPERATOR = /^(author|after|before|file|branch):(.+)$/i;

/** Splits a search box query into recognized `key:value` operators and whatever free text is
 * left over. No quoting support (a value can't contain a space) — kept simple since none of the
 * operators' values (an author fragment, a date, a path, a branch name) typically need one. */
export function parseSearchQuery(raw: string): ParsedQuery {
  const result: ParsedQuery = { text: "", author: null, after: null, before: null, file: null, branches: [] };
  const textParts: string[] = [];
  for (const token of raw.trim().split(/\s+/).filter(Boolean)) {
    const match = OPERATOR.exec(token);
    if (!match) {
      textParts.push(token);
      continue;
    }
    const key = match[1]!.toLowerCase();
    const value = match[2]!;
    if (key === "author") result.author = value;
    else if (key === "after") result.after = value;
    else if (key === "before") result.before = value;
    else if (key === "file") result.file = value;
    else if (key === "branch") result.branches.push(value);
  }
  result.text = textParts.join(" ");
  return result;
}

export function isQueryEmpty(q: ParsedQuery): boolean {
  return q.text === "" && q.author === null && q.after === null && q.before === null && q.file === null && q.branches.length === 0;
}
