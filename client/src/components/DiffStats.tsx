import type { FileDiffSummary } from "@minigit2/shared";
import { getPalette, type Theme } from "../design-system/palette";

interface Props {
  files: FileDiffSummary[];
  theme: Theme;
}

const MAX_BAR_CHARS = 16;
const MAX_GROUPS = 12;

interface StatNode {
  children: Map<string, StatNode>;
  additions: number;
  deletions: number;
  isFile: boolean;
}

interface DiffStatGroup {
  label: string;
  additions: number;
  deletions: number;
}

function buildStatsTree(files: FileDiffSummary[]): StatNode {
  const root: StatNode = { children: new Map(), additions: 0, deletions: 0, isFile: false };
  for (const file of files) {
    const parts = file.path.split("/");
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]!;
      let next = cur.children.get(name);
      if (!next) {
        next = { children: new Map(), additions: 0, deletions: 0, isFile: i === parts.length - 1 };
        cur.children.set(name, next);
      }
      next.additions += file.additions;
      next.deletions += file.deletions;
      cur = next;
    }
  }
  return root;
}

/** Collapses single-child directory chains into their parent's label (like VS Code's "compact
 * folders"), so a commit confined to one deep subtree of a monorepo still yields one row instead
 * of a naive first-segment split that would just show the monorepo's top-level app/package name
 * for every row. A directory whose children are all plain files (no further nesting) also
 * collapses into one row — several sibling files changed in the same flat directory are one
 * group, not one row each. Real structural forks (a directory containing both files and
 * subdirectories, or several subdirectories) recurse per child instead of guessing an aggregate. */
function collectGroups(node: StatNode, prefix: string): DiffStatGroup[] {
  if (node.isFile) {
    return [{ label: prefix, additions: node.additions, deletions: node.deletions }];
  }
  const entries = [...node.children.entries()];
  if (entries.length === 1) {
    const [name, child] = entries[0]!;
    return collectGroups(child, child.isFile ? `${prefix}${name}` : `${prefix}${name}/`);
  }
  const allFiles = entries.every(([, child]) => child.isFile);
  if (prefix !== "" && allFiles) {
    return [{ label: prefix, additions: node.additions, deletions: node.deletions }];
  }
  const groups: DiffStatGroup[] = [];
  for (const [name, child] of entries) {
    groups.push(...collectGroups(child, child.isFile ? `${prefix}${name}` : `${prefix}${name}/`));
  }
  return groups;
}

export function buildDiffStatGroups(files: FileDiffSummary[]): DiffStatGroup[] {
  if (files.length === 0) return [];
  const groups = collectGroups(buildStatsTree(files), "");
  groups.sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions));
  return groups;
}

/** Splits a compressed label into everything but its last segment (truncatable, shrinks first)
 * and the last segment itself (always shown in full) — a middle-truncation effect with no JS
 * width measurement: two flex children, the first `overflow: hidden; text-overflow: ellipsis`,
 * the second `flex-shrink: 0`. */
function splitLabel(label: string): [prefix: string, suffix: string] {
  const trimmed = label.endsWith("/") ? label.slice(0, -1) : label;
  const idx = trimmed.lastIndexOf("/");
  if (idx === -1) return ["", label];
  const suffix = trimmed.slice(idx + 1) + (label.endsWith("/") ? "/" : "");
  return [trimmed.slice(0, idx + 1), suffix];
}

export default function DiffStats({ files, theme }: Props) {
  const groups = buildDiffStatGroups(files);
  if (groups.length === 0) return null;

  const pal = getPalette(theme);
  const addColor = pal[1]!.text;
  const delColor = pal[5]!.text;

  const shown = groups.slice(0, MAX_GROUPS);
  const hiddenCount = groups.length - shown.length;
  const maxTotal = Math.max(...shown.map((g) => g.additions + g.deletions), 1);

  return (
    <div className="diffstats">
      {shown.map((g) => {
        const [prefix, suffix] = splitLabel(g.label);
        const total = g.additions + g.deletions;
        const barLen = total === 0 ? 0 : Math.max(1, Math.round((total / maxTotal) * MAX_BAR_CHARS));
        const addChars = total === 0 ? 0 : Math.round((barLen * g.additions) / total);
        const delChars = barLen - addChars;
        return (
          <div className="diffstats-row" key={g.label}>
            <span className="diffstats-label" title={g.label}>
              <span className="diffstats-label-prefix">{prefix}</span>
              <span className="diffstats-label-suffix">{suffix}</span>
            </span>
            <span className="diffstats-counts">
              +{g.additions} -{g.deletions}
            </span>
            <span className="diffstats-bar">
              <span style={{ color: addColor }}>{"█".repeat(addChars)}</span>
              <span style={{ color: delColor }}>{"█".repeat(delChars)}</span>
            </span>
          </div>
        );
      })}
      {hiddenCount > 0 && <div className="diffstats-more">+{hiddenCount} more</div>}
    </div>
  );
}
