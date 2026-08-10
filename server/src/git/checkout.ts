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
const NOT_FAST_FORWARD_MARKERS = ["Not possible to fast-forward"];

export async function checkoutRef(repoPath: string, ref: string): Promise<void> {
  try {
    const target = await resolveCheckoutTarget(repoPath, ref);
    await runGit(repoPath, ["checkout", target.shortName]);
    // Double-clicking a remote badge is meant to mean "get me on this branch, matching the
    // remote" — plain `git checkout` only switches HEAD, it never moves a local branch that's
    // behind its remote-tracking ref (including the no-op case of already being on it). Bring
    // it up to date whenever that's a clean fast-forward; silently leave it alone otherwise
    // (the local branch has its own commits ahead of the remote, which is a normal state, not
    // an error).
    if (target.remoteRef) {
      await fastForwardTo(repoPath, target.remoteRef);
    }
  } catch (err) {
    if (err instanceof GitError && CONFLICT_MARKERS.some((marker) => err.stderr.includes(marker))) {
      throw new CheckoutConflictError(err.stderr);
    }
    throw err;
  }
}

async function fastForwardTo(repoPath: string, remoteRef: string): Promise<void> {
  try {
    await runGit(repoPath, ["merge", "--ff-only", remoteRef]);
  } catch (err) {
    if (err instanceof GitError && NOT_FAST_FORWARD_MARKERS.some((marker) => err.stderr.includes(marker))) {
      return;
    }
    throw err;
  }
}

interface CheckoutTarget {
  shortName: string;
  /** Set when `ref` was a remote-tracking branch — the same ref, to fast-forward the local
   * branch onto once checked out. */
  remoteRef: string | null;
}

/**
 * `git checkout origin/foo` (the fully-qualified remote-tracking ref) always detaches HEAD —
 * unlike `git checkout foo`, it never triggers git's own DWIM local-tracking-branch creation.
 * Double-clicking a remote badge is meant to mean "switch to this branch", so when the ref is
 * exactly a remote-tracking branch, strip the remote prefix and let git's own checkout resolve
 * the short name — reusing an existing local branch of that name if there is one, or creating a
 * new one tracking the remote, exactly as `git checkout foo` would from the CLI.
 */
async function resolveCheckoutTarget(repoPath: string, ref: string): Promise<CheckoutTarget> {
  try {
    await runGit(repoPath, ["show-ref", "--verify", "--quiet", `refs/remotes/${ref}`]);
  } catch {
    return { shortName: ref, remoteRef: null };
  }
  const { stdout } = await runGit(repoPath, ["remote"]);
  const remotes = stdout.split("\n").map((r) => r.trim()).filter(Boolean);
  for (const remote of remotes) {
    if (ref.startsWith(`${remote}/`)) {
      const shortName = ref.slice(remote.length + 1);
      if (shortName) return { shortName, remoteRef: ref };
    }
  }
  return { shortName: ref, remoteRef: null };
}
