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
    const target = await resolveCheckoutTarget(repoPath, ref);
    await runGit(repoPath, ["checkout", target]);
  } catch (err) {
    if (err instanceof GitError && CONFLICT_MARKERS.some((marker) => err.stderr.includes(marker))) {
      throw new CheckoutConflictError(err.stderr);
    }
    throw err;
  }
}

/**
 * `git checkout origin/foo` (the fully-qualified remote-tracking ref) always detaches HEAD —
 * unlike `git checkout foo`, it never triggers git's own DWIM local-tracking-branch creation.
 * Double-clicking a remote badge is meant to mean "switch to this branch", so when the ref is
 * exactly a remote-tracking branch, strip the remote prefix and let git's own checkout resolve
 * the short name — reusing an existing local branch of that name if there is one, or creating a
 * new one tracking the remote, exactly as `git checkout foo` would from the CLI.
 */
async function resolveCheckoutTarget(repoPath: string, ref: string): Promise<string> {
  try {
    await runGit(repoPath, ["show-ref", "--verify", "--quiet", `refs/remotes/${ref}`]);
  } catch {
    return ref;
  }
  const { stdout } = await runGit(repoPath, ["remote"]);
  const remotes = stdout.split("\n").map((r) => r.trim()).filter(Boolean);
  for (const remote of remotes) {
    if (ref.startsWith(`${remote}/`)) {
      const shortName = ref.slice(remote.length + 1);
      if (shortName) return shortName;
    }
  }
  return ref;
}
