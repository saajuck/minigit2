import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { linkifyMessage } from "./linkifyMessage";

const REMOTE_URL = "git@gitlab.com:owner/repo.git";

describe("linkifyMessage", () => {
  it("leaves plain text with nothing to link untouched", () => {
    render(<div>{linkifyMessage("fix login bug", null)}</div>);
    expect(screen.getByText("fix login bug")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("turns a bare URL into a clickable link, opening in a new tab", () => {
    render(<div>{linkifyMessage("See https://example.com/x for details", null)}</div>);
    const link = screen.getByRole("link", { name: "https://example.com/x" });
    expect(link).toHaveAttribute("href", "https://example.com/x");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("turns a GitLab !123 reference into a merge-request link when a remote URL is known", () => {
    render(<div>{linkifyMessage("See merge request repo!42", REMOTE_URL)}</div>);
    const link = screen.getByRole("link", { name: "!42" });
    expect(link).toHaveAttribute("href", "https://gitlab.com/owner/repo/-/merge_requests/42");
  });

  it("leaves a !123 reference as plain text when there's no remote URL to link it to", () => {
    render(<div>{linkifyMessage("See merge request repo!42", null)}</div>);
    expect(screen.getByText(/repo!42/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links both a URL and an MR reference in the same message", () => {
    render(<div>{linkifyMessage("https://example.com/x and !7", REMOTE_URL)}</div>);
    expect(screen.getByRole("link", { name: "https://example.com/x" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "!7" })).toBeInTheDocument();
  });

  it("matches !123 immediately after other characters, with no required whitespace/word boundary", () => {
    // GitLab's own auto-appended "See merge request <namespace>!<id>" convention has no space
    // before the "!" — this is the case the pattern is explicitly designed around.
    render(<div>{linkifyMessage("equinox-ccg/altered!15", REMOTE_URL)}</div>);
    const link = screen.getByRole("link", { name: "!15" });
    expect(link).toHaveAttribute("href", "https://gitlab.com/owner/repo/-/merge_requests/15");
  });
});
