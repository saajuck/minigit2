import { describe, expect, it } from "vitest";
import { isQueryEmpty, parseSearchQuery } from "./query";

describe("parseSearchQuery", () => {
  it("treats a query with no operators as plain free text", () => {
    expect(parseSearchQuery("fix login bug")).toEqual({
      text: "fix login bug",
      author: null,
      after: null,
      before: null,
      file: null,
      branches: [],
    });
  });

  it("parses a single operator", () => {
    expect(parseSearchQuery("author:alice")).toEqual({
      text: "",
      author: "alice",
      after: null,
      before: null,
      file: null,
      branches: [],
    });
  });

  it("is case-insensitive on the operator key but not on its value", () => {
    expect(parseSearchQuery("AUTHOR:Alice")).toMatchObject({ author: "Alice" });
  });

  it("mixes operators with free text in any order", () => {
    const result = parseSearchQuery("fix author:bob login before:2024-01-01");
    expect(result).toEqual({
      text: "fix login",
      author: "bob",
      after: null,
      before: "2024-01-01",
      file: null,
      branches: [],
    });
  });

  it("collects multiple branch: tokens instead of overwriting", () => {
    const result = parseSearchQuery("branch:main branch:dev");
    expect(result.branches).toEqual(["main", "dev"]);
  });

  it("collapses repeated/leading/trailing whitespace", () => {
    expect(parseSearchQuery("   fix   login   ").text).toBe("fix login");
  });

  it("returns the empty query for a blank string", () => {
    expect(parseSearchQuery("").text).toBe("");
    expect(parseSearchQuery("   ")).toEqual({
      text: "",
      author: null,
      after: null,
      before: null,
      file: null,
      branches: [],
    });
  });

  it("doesn't treat a bare 'key:' with no value as an operator (falls back to free text)", () => {
    // OPERATOR requires `(.+)` after the colon — an empty value doesn't match, so the whole
    // token is left as free text rather than producing e.g. author: "".
    expect(parseSearchQuery("author:")).toEqual({
      text: "author:",
      author: null,
      after: null,
      before: null,
      file: null,
      branches: [],
    });
  });

  it("ignores an unrecognized key:value-shaped token as free text", () => {
    expect(parseSearchQuery("status:open")).toMatchObject({ text: "status:open", author: null });
  });
});

describe("isQueryEmpty", () => {
  it("is true only when every field is at its default", () => {
    expect(isQueryEmpty(parseSearchQuery(""))).toBe(true);
  });

  it("is false when free text is present", () => {
    expect(isQueryEmpty(parseSearchQuery("fix"))).toBe(false);
  });

  it("is false when only an operator is present, with no free text", () => {
    expect(isQueryEmpty(parseSearchQuery("author:alice"))).toBe(false);
  });
});
