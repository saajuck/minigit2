import { describe, expect, it } from "vitest";
import { isUnsafeRef } from "./exec";

describe("isUnsafeRef", () => {
  it("rejects a ref that looks like a git option", () => {
    expect(isUnsafeRef("--output=/etc/passwd")).toBe(true);
    expect(isUnsafeRef("--upload-pack=/bin/sh")).toBe(true);
    expect(isUnsafeRef("-")).toBe(true);
  });

  it("accepts real refs/hashes", () => {
    expect(isUnsafeRef("main")).toBe(false);
    expect(isUnsafeRef("HEAD")).toBe(false);
    expect(isUnsafeRef("origin/main")).toBe(false);
    expect(isUnsafeRef("a1b2c3d4")).toBe(false);
    expect(isUnsafeRef("refs/heads/feature/x")).toBe(false);
  });

  it("accepts a ref that merely contains a dash, not at the start", () => {
    expect(isUnsafeRef("feature-branch")).toBe(false);
  });
});
