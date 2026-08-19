import { runGit } from "./exec";

/** A cheap-to-compute string that changes if and only if some ref (branch, tag, remote-tracking
 * branch) was added, removed, or moved to point at a different commit — one `for-each-ref` call,
 * independent of history length, versus the O(commits) cost of a full `git log --all` walk.
 * Used to decide whether the expensive getCommitLog + layoutGraph pipeline actually needs to
 * rerun for a `/graph` request, or whether a cached result from last time is still valid.
 * `--sort=refname` makes the output byte-identical across two calls with the same ref set,
 * rather than left to whatever internal order git happens to iterate refs in. */
export async function getRefTipsSignature(repoPath: string): Promise<string> {
  const { stdout } = await runGit(repoPath, [
    "for-each-ref",
    "--sort=refname",
    "--format=%(objectname) %(refname)",
  ]);
  return stdout;
}
