import { useState } from "react";
import type { FileDiff as FileDiffType } from "@minigit2/shared";

interface Props {
  file: FileDiffType;
}

const STATUS_LABEL: Record<FileDiffType["status"], string> = {
  added: "+",
  deleted: "−",
  modified: "M",
  renamed: "R",
};

export default function FileDiff({ file }: Props) {
  const [open, setOpen] = useState(false);
  const lines = file.patch.split("\n");

  return (
    <div className="file-diff">
      <button type="button" className="file-diff-header" onClick={() => setOpen((o) => !o)}>
        <span className={`status status-${file.status}`}>{STATUS_LABEL[file.status]}</span>
        <span className="path">{file.path}</span>
      </button>
      {open && (
        <pre className="patch">
          {lines.map((line, i) => (
            <div key={i} className={lineClass(line)}>
              {line}
            </div>
          ))}
        </pre>
      )}
    </div>
  );
}

function lineClass(line: string): string {
  if (line.startsWith("+++") || line.startsWith("---")) return "diff-file-header";
  if (line.startsWith("+")) return "diff-add";
  if (line.startsWith("-")) return "diff-del";
  if (line.startsWith("@@")) return "diff-hunk";
  return "";
}
