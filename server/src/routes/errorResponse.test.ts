import type { Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { GitError } from "../git/exec";
import { respondGitError } from "./errorResponse";

function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status } as unknown as Response;
  return { res, status, json };
}

describe("respondGitError", () => {
  it("responds 500 git_error for a generic failure", () => {
    const { res, status, json } = mockRes();
    respondGitError(res, new Error("boom"));
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: "git_error", message: "boom" });
  });

  it("responds 500 git_error for a missing-object failure when no notFoundMessage is given", () => {
    const { res, status, json } = mockRes();
    respondGitError(res, new GitError("failed", "fatal: bad object abc123"));
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: "git_error" }));
  });

  it("responds 404 commit_not_found for a missing-object failure when notFoundMessage is given", () => {
    const { res, status, json } = mockRes();
    respondGitError(res, new GitError("failed", "fatal: bad object abc123"), "gone");
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ error: "commit_not_found", message: "gone" });
  });

  it("still responds 500 git_error for a non-missing-object failure even with notFoundMessage given", () => {
    const { res, status, json } = mockRes();
    respondGitError(res, new GitError("failed", "fatal: not a git repository"), "gone");
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: "git_error" }));
  });
});
