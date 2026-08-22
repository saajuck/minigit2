import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitResult {
  stdout: string;
  stderr: string;
}

export class GitError extends Error {
  readonly stderr: string;

  constructor(message: string, stderr: string) {
    super(message);
    this.name = "GitError";
    this.stderr = stderr;
  }
}

export interface RunGitOptions {
  /** Exit codes to treat as success rather than a GitError — e.g. `git diff --no-index` uses 1 to mean "differences found", not failure. */
  allowExitCodes?: number[];
  /** Kills the process past this many ms — for commands that can hang on the network (e.g. `fetch`). */
  timeoutMs?: number;
  /** Merged on top of the inherited environment. */
  env?: NodeJS.ProcessEnv;
}

/** True for a user-supplied ref/hash that could be misread as a git command-line option instead
 * of a revision (e.g. `--output=/etc/passwd`, `--upload-pack=...`) when passed as a bare
 * positional argument to `git`. The single source of truth for "what makes a ref unsafe" — every
 * server route that accepts a ref/hash from the client (`:hash` route params, `ref`/`from`/`to`
 * body or query params) must check this on that value before it reaches `runGit` and reject it
 * if true. Inserting a `--` end-of-options marker in front of it is NOT a substitute here, since
 * `--` before a *revision* (as opposed to a path) changes git's own parsing of what follows
 * (`git log <rev> -- <path>` treats args after `--` as pathspecs, not revisions), so it would
 * just as easily break normal lookups as it would "neutralize" this one. */
export function isUnsafeRef(ref: string): boolean {
  return ref.startsWith("-");
}

export async function runGit(cwd: string, args: string[], options: RunGitOptions = {}): Promise<GitResult> {
  try {
    const { stdout, stderr } = await execFileAsync("git", ["-C", cwd, ...args], {
      maxBuffer: 1024 * 1024 * 64,
      timeout: options.timeoutMs,
      // Force git's own messages back to English/C regardless of the host's locale: checkout.ts
      // (and anything else inspecting stderr text) matches on git's stable English wording, which
      // a translated git install would otherwise silently break.
      env: { ...process.env, LANG: "C", LC_ALL: "C", ...options.env },
    });
    return { stdout, stderr };
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string; message: string; code?: number };
    if (options.allowExitCodes?.includes(e.code ?? -1)) {
      return { stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
    }
    throw new GitError(e.message, e.stderr ?? "");
  }
}
