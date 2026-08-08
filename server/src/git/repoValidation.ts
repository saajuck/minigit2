import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { runGit } from "./exec";

export type RepoValidationCode = "not_found" | "not_a_directory" | "not_a_git_repo";

export class RepoValidationError extends Error {
  readonly code: RepoValidationCode;

  constructor(code: RepoValidationCode, message: string) {
    super(message);
    this.name = "RepoValidationError";
    this.code = code;
  }
}

/**
 * Resolves rawPath to an absolute path and confirms it's inside a git work tree.
 * Returns the work tree's root (not the raw input) so that picking any subdirectory
 * of a repo — e.g. via the folder browser — normalizes to that repo's own path,
 * rather than registering the subdirectory as if it were a separate repo.
 * Throws RepoValidationError otherwise.
 */
export async function assertValidRepoPath(rawPath: string): Promise<string> {
  const absPath = path.resolve(rawPath);
  if (!existsSync(absPath)) {
    throw new RepoValidationError("not_found", `Path does not exist: ${absPath}`);
  }
  if (!statSync(absPath).isDirectory()) {
    throw new RepoValidationError("not_a_directory", `Path is not a directory: ${absPath}`);
  }
  try {
    const { stdout } = await runGit(absPath, ["rev-parse", "--is-inside-work-tree"]);
    if (stdout.trim() !== "true") {
      throw new RepoValidationError("not_a_git_repo", `Path is not a git work tree: ${absPath}`);
    }
    const toplevel = await runGit(absPath, ["rev-parse", "--show-toplevel"]);
    return toplevel.stdout.trim();
  } catch (err) {
    if (err instanceof RepoValidationError) throw err;
    throw new RepoValidationError("not_a_git_repo", `Path is not a git repository: ${absPath}`);
  }
}
