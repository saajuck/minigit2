import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { validateHashParam } from "./validateRef";

function mockReqRes() {
  const req = {} as Request;
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status } as unknown as Response;
  const next = vi.fn();
  return { req, res, status, json, next };
}

describe("validateHashParam", () => {
  it("calls next() for a normal hash", () => {
    const { req, res, next, status } = mockReqRes();
    validateHashParam(req, res, next, "a1b2c3d4");
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });

  it("rejects a hash that looks like a git option, with 400 and no next()", () => {
    const { req, res, next, status, json } = mockReqRes();
    validateHashParam(req, res, next, "--output=/etc/passwd");
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: "invalid_ref" }));
  });
});
