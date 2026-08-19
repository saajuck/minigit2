import { describe, expect, it } from "vitest";
import { deriveCommitUrl, deriveMergeRequestUrl } from "./remoteUrl";

describe("deriveCommitUrl", () => {
  it("turns an SCP-like SSH remote into a GitHub-style commit URL", () => {
    expect(deriveCommitUrl("git@github.com:owner/repo.git", "abc123")).toBe(
      "https://github.com/owner/repo/commit/abc123",
    );
  });

  it("turns an ssh:// remote into a commit URL", () => {
    expect(deriveCommitUrl("ssh://git@github.com/owner/repo.git", "abc123")).toBe(
      "https://github.com/owner/repo/commit/abc123",
    );
  });

  it("turns a plain https remote into a commit URL, stripping .git", () => {
    expect(deriveCommitUrl("https://github.com/owner/repo.git", "abc123")).toBe(
      "https://github.com/owner/repo/commit/abc123",
    );
  });

  it("works without a trailing .git", () => {
    expect(deriveCommitUrl("https://github.com/owner/repo", "abc123")).toBe(
      "https://github.com/owner/repo/commit/abc123",
    );
  });

  it("uses GitLab's /-/commit/ path for a gitlab.com remote", () => {
    expect(deriveCommitUrl("git@gitlab.com:owner/repo.git", "abc123")).toBe(
      "https://gitlab.com/owner/repo/-/commit/abc123",
    );
  });

  it("uses GitLab's path for a self-hosted GitLab instance, detected by hostname", () => {
    expect(deriveCommitUrl("git@gitlab.mycompany.com:owner/repo.git", "abc123")).toBe(
      "https://gitlab.mycompany.com/owner/repo/-/commit/abc123",
    );
  });

  it("uses Bitbucket's /commits/ (plural, no dash) path for a bitbucket.org remote", () => {
    expect(deriveCommitUrl("git@bitbucket.org:owner/repo.git", "abc123")).toBe(
      "https://bitbucket.org/owner/repo/commits/abc123",
    );
  });

  it("returns null for a local filesystem path", () => {
    expect(deriveCommitUrl("/home/user/repos/myrepo", "abc123")).toBeNull();
  });

  it("returns null for a non-http(s) URL scheme", () => {
    expect(deriveCommitUrl("ftp://example.com/repo.git", "abc123")).toBeNull();
  });
});

describe("deriveMergeRequestUrl", () => {
  it("builds a GitLab merge-request URL regardless of host (no host sniffing)", () => {
    expect(deriveMergeRequestUrl("git@gitlab.com:owner/repo.git", "42")).toBe(
      "https://gitlab.com/owner/repo/-/merge_requests/42",
    );
  });

  it("returns null for a remote URL that can't be turned into a web base", () => {
    expect(deriveMergeRequestUrl("/home/user/repos/myrepo", "42")).toBeNull();
  });
});
