import { useEffect, useState, type ReactNode } from "react";
import type { BlameResponse, FileDiffSummary, FileHotspot } from "@minigit2/shared";
import type { Theme } from "../design-system/palette";
import { ChevronRightIcon, FolderTreeIcon, ListIcon } from "../design-system/icons";
import FileDiff from "./FileDiff";

type ViewMode = "list" | "tree";
const VIEW_MODE_KEY = "minigit2:diffViewMode";

interface Props {
  files: FileDiffSummary[];
  theme: Theme;
  fetchPatch: (file: FileDiffSummary) => () => Promise<string>;
  fetchBlame?: (file: FileDiffSummary) => () => Promise<BlameResponse>;
  fetchHotspot?: (file: FileDiffSummary) => () => Promise<FileHotspot>;
  onSelectCommit?: (hash: string) => void;
}

/** Wraps the flat file list shared by every diff mode (single commit, compare, local changes),
 * with a GitLab-style toggle between a flat list and a directory tree. */
export default function FileChangeList({ files, theme, fetchPatch, fetchBlame, fetchHotspot, onSelectCommit }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    localStorage.getItem(VIEW_MODE_KEY) === "tree" ? "tree" : "list",
  );

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  function renderFile(file: FileDiffSummary, displayPath: string) {
    return (
      <FileDiff
        key={file.oldPath ?? file.path}
        file={file}
        displayPath={displayPath}
        theme={theme}
        fetchPatch={fetchPatch(file)}
        fetchBlame={fetchBlame?.(file)}
        fetchHotspot={fetchHotspot?.(file)}
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
      {viewMode === "list" ? files.map((file) => renderFile(file, file.path)) : <FileTree files={files} renderFile={renderFile} />}
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
