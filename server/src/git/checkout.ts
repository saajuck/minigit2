import { GitError, runGit } from "./exec";

export class CheckoutConflictError extends Error {
  readonly stderr: string;

  constructor(stderr: string) {
    super("Checkout would overwrite local changes");
    this.name = "CheckoutConflictError";
    this.stderr = stderr;
  }
}

const CONFLICT_MARKERS = ["would be overwritten", "Please commit your changes", "Please move or remove"];

export async function checkoutRef(repoPath: string, ref: string): Promise<void> {
  try {
    await runGit(repoPath, ["checkout", ref]);
  } catch (err) {
    if (err instanceof GitError && CONFLICT_MARKERS.some((marker) => err.stderr.includes(marker))) {
      throw new CheckoutConflictError(err.stderr);
    }
    throw err;
  }
}
