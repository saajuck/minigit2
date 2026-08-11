import type { CommitNode } from "@minigit2/shared";

/** Union of every ancestor (via `parents`) reachable from `startHashes`, walked client-side over
 * an already-loaded graph — no extra request. Shared by branch focus (ancestors of the focused
 * branches' heads) and the `branch:` search operator (ancestors of the named branches' heads). */
export function ancestorHashes(byHash: Map<string, CommitNode>, startHashes: string[]): Set<string> {
  const visited = new Set<string>();
  const stack = [...startHashes];
  while (stack.length > 0) {
    const hash = stack.pop()!;
    if (visited.has(hash)) continue;
    visited.add(hash);
    const node = byHash.get(hash);
    if (!node) continue;
    for (const parent of node.parents) {
      if (!visited.has(parent)) stack.push(parent);
    }
  }
  return visited;
}
