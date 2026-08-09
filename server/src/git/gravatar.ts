import { createHash } from "node:crypto";

/** Gravatar identicon fallback — no account required for the avatar to render something. */
export function gravatarUrl(email: string): string {
  const hash = createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?s=64&d=identicon`;
}
