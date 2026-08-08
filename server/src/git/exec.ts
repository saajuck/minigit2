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

export async function runGit(cwd: string, args: string[]): Promise<GitResult> {
  try {
    const { stdout, stderr } = await execFileAsync("git", ["-C", cwd, ...args], {
      maxBuffer: 1024 * 1024 * 64,
    });
    return { stdout, stderr };
  } catch (err) {
    const e = err as { stderr?: string; message: string };
    throw new GitError(e.message, e.stderr ?? "");
  }
}
