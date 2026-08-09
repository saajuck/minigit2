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
}

export async function runGit(cwd: string, args: string[], options: RunGitOptions = {}): Promise<GitResult> {
  try {
    const { stdout, stderr } = await execFileAsync("git", ["-C", cwd, ...args], {
      maxBuffer: 1024 * 1024 * 64,
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
