/** Turns a git remote URL (SSH scp-like `git@host:owner/repo.git`, `ssh://git@host/owner/repo`,
 * or plain `https://host/owner/repo(.git)`) into the `https://host/owner/repo` web URL a
 * browser can open. Returns null for anything that isn't recognizably one of those forms (a
 * local filesystem path, for instance). */
function toWebBase(remoteUrl: string): string | null {
  const trimmed = remoteUrl.trim();

  const scpMatch = /^(?:ssh:\/\/)?git@([^:/]+)[:/](.+?)(?:\.git)?\/?$/.exec(trimmed);
  if (scpMatch) {
    return `https://${scpMatch[1]}/${scpMatch[2]}`;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const path = url.pathname.replace(/\.git\/?$/, "").replace(/^\//, "");
    return path ? `https://${url.host}/${path}` : null;
  } catch {
    return null;
  }
}

/** Host-specific commit page path — detected by hostname since a self-hosted GitLab/Bitbucket
 * instance won't otherwise identify itself. Falls back to the GitHub-style path, which also
 * covers GitHub-compatible forges (Gitea, Forgejo, ...) that mirror the same URL scheme. */
export function deriveCommitUrl(remoteUrl: string, hash: string): string | null {
  const webBase = toWebBase(remoteUrl);
  if (!webBase) return null;
  const host = new URL(webBase).hostname;
  if (host.includes("gitlab")) return `${webBase}/-/commit/${hash}`;
  if (host.includes("bitbucket")) return `${webBase}/commits/${hash}`;
  return `${webBase}/commit/${hash}`;
}
