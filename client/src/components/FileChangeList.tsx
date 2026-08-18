import { useEffect, useRef, useState, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { BlameResponse, FileDiffSummary, FileHotspot } from "@minigit2/shared";
import type { Theme } from "../design-system/palette";
import { ChevronRightIcon, FolderTreeIcon, ListIcon } from "../design-system/icons";
import FileDiff, { type Query } from "./FileDiff";

type ViewMode = "list" | "tree";
const VIEW_MODE_KEY = "minigit2:diffViewMode";
// A collapsed file row is ~38px (see .file-diff-header-main padding); this is only the
// virtualizer's first guess before it measures the real, possibly-expanded height of each row —
// close enough that the initial paint doesn't jump around while measurements settle in.
const ESTIMATED_ROW_HEIGHT = 38;

interface Props {
  files: FileDiffSummary[];
  theme: Theme;
  fetchPatch: (file: FileDiffSummary) => Query<string>;
  fetchBlame?: (file: FileDiffSummary) => Query<BlameResponse>;
  /** Already-resolved hotspot stats for every file in `files`, keyed by path — fetched once by
   * the parent (a single batched request) rather than per file. See FileDiff's `hotspot` prop. */
  hotspots?: Record<string, FileHotspot>;
  onSelectCommit?: (hash: string) => void;
}

/** Wraps the flat file list shared by every diff mode (single commit, compare, local changes),
 * with a GitLab-style toggle between a flat list and a directory tree. */
export default function FileChangeList({ files, theme, fetchPatch, fetchBlame, hotspots, onSelectCommit }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    localStorage.getItem(VIEW_MODE_KEY) === "tree" ? "tree" : "list",
  );

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  function renderFile(file: FileDiffSummary, displayPath: string) {
    return (
      <FileDiff
        file={file}
        displayPath={displayPath}
        theme={theme}
        fetchPatch={fetchPatch(file)}
        fetchBlame={fetchBlame?.(file)}
        hotspot={hotspots?.[file.path]}
        onSelectCommit={onSelectCommit}
      />
    );
  }

  return (
    <div className="diff-files">
      <div className="diff-files-toolbar">
        <span className="diff-files-count">
          {files.length} file{files.length === 1 ? "" : "s"} changed
        </span>
        <div className="diff-view-mode-toggle">
          <button
            type="button"
            className={viewMode === "list" ? "active" : ""}
            title="List view"
            aria-label="List view"
            onClick={() => setViewMode("list")}
          >
            <ListIcon />
          </button>
          <button
            type="button"
            className={viewMode === "tree" ? "active" : ""}
            title="Tree view"
            aria-label="Tree view"
            onClick={() => setViewMode("tree")}
          >
            <FolderTreeIcon />
          </button>
        </div>
      </div>
      {viewMode === "list" ? (
        <VirtualFileList files={files} renderFile={renderFile} />
      ) : (
        // Not virtualized: a directory's children can collapse/expand at any depth, so the set
        // of "visible" rows isn't a simple slice of `files` the way the flat list's is — same
        // simplification the tree view already made for search/focus dimming elsewhere.
        <div className="diff-files-scroll">
          <FileTree files={files} renderFile={renderFile} />
        </div>
      )}
    </div>
  );
}

/** Windowed flat file list — only mounts (and measures) rows near the scrolled-to viewport.
 * Matters because a single commit can touch hundreds of files: without this, every row mounts
 * at once regardless of scroll position, which used to also mean hundreds of parallel hotspot
 * requests firing on mount (that fan-out is fixed separately now, hotspot is one batched request
 * per commit — but the DOM cost of mounting hundreds of rows up front remains without this).
 * Row height is variable (an expanded file's patch can be arbitrarily tall), so this uses
 * `measureElement` rather than a fixed size — same reasoning FileDiff's patch view already
 * doesn't try to virtualize *within* one file. */
function VirtualFileList({
  files,
  renderFile,
}: {
  files: FileDiffSummary[];
  renderFile: (file: FileDiffSummary, displayPath: string) => ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 8,
    getItemKey: (index) => files[index]!.oldPath ?? files[index]!.path,
  });

  return (
    <div ref={scrollRef} className="diff-files-scroll">
      <div style={{ position: "relative", height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const file = files[row.index]!;
          return (
            <div
              key={row.key}
              data-index={row.index}
              ref={virtualizer.measureElement}
              className="diff-files-virtual-row"
              style={{ transform: `translateY(${row.start}px)` }}
            >
              {renderFile(file, file.path)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface TreeDir {
  type: "dir";
  name: string;
  path: string;
  children: TreeNode[];
}
interface TreeFile {
  type: "file";
  name: string;
  file: FileDiffSummary;
}
type TreeNode = TreeDir | TreeFile;

function buildTree(files: FileDiffSummary[]): TreeDir {
  const root: TreeDir = { type: "dir", name: "", path: "", children: [] };
  for (const file of files) {
    const parts = file.path.split("/");
    let cursor = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const name = parts[i]!;
      const path = parts.slice(0, i + 1).join("/");
      let next = cursor.children.find((c): c is TreeDir => c.type === "dir" && c.name === name);
      if (!next) {
        next = { type: "dir", name, path, children: [] };
        cursor.children.push(next);
      }
      cursor = next;
    }
    cursor.children.push({ type: "file", name: parts[parts.length - 1]!, file });
  }
  sortTree(root);
  return root;
}

function sortTree(dir: TreeDir) {
  dir.children.sort((a, b) => (a.type !== b.type ? (a.type === "dir" ? -1 : 1) : a.name.localeCompare(b.name)));
  for (const child of dir.children) {
    if (child.type === "dir") sortTree(child);
  }
}

function FileTree({
  files,
  renderFile,
}: {
  files: FileDiffSummary[];
  renderFile: (file: FileDiffSummary, displayPath: string) => ReactNode;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const root = buildTree(files);

  function toggleDir(path: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function renderNode(node: TreeNode, depth: number): ReactNode {
    if (node.type === "file") {
      return (
        <div key={node.file.oldPath ?? node.file.path} className="file-tree-row" style={{ paddingLeft: depth * 16 }}>
          {renderFile(node.file, node.name)}
        </div>
      );
    }
    const isCollapsed = collapsed.has(node.path);
    return (
      <div key={node.path}>
        <button
          type="button"
          className="file-tree-dir"
          style={{ paddingLeft: depth * 16 + 10 }}
          onClick={() => toggleDir(node.path)}
        >
          <span className="file-tree-chevron" style={{ transform: `rotate(${isCollapsed ? 0 : 90}deg)` }}>
            <ChevronRightIcon />
          </span>
          {node.name}/
        </button>
        {!isCollapsed && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return <>{root.children.map((child) => renderNode(child, 0))}</>;
}
