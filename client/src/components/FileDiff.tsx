import { useState } from "react";
import type { FileDiffSummary } from "@minigit2/shared";
import { api } from "../api/client";

interface Props {
  repoId: string;
  hash: string;
  file: FileDiffSummary;
}

const STATUS_LABEL: Record<FileDiffSummary["status"], string> = {
  added: "+",
  deleted: "−",
  modified: "M",
  renamed: "R",
};

export default function FileDiff({ repoId, hash, file }: Props) {
  const [open, setOpen] = useState(false);
  const [patch, setPatch] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && patch === null && !loading) {
      setLoading(true);
      setError(null);
      api
        .getFilePatch(repoId, hash, file.path)
        .then((data) => setPatch(data.patch))
        .catch((err) => setError((err as Error).message))
        .finally(() => setLoading(false));
    }
  }

  return (
    <div className="file-diff">
      <button type="button" className="file-diff-header" onClick={toggle}>
        <span className={`status status-${file.status}`}>{STATUS_LABEL[file.status]}</span>
        <span className="path">{file.path}</span>
      </button>
      {open && (
        <>
          {loading && <p className="muted">Loading…</p>}
          {error && <p className="error">{error}</p>}
          {patch !== null && (
            <pre className="patch">
              {patch.split("\n").map((line, i) => (
                <div key={i} className={lineClass(line)}>
                  {line}
                </div>
              ))}
            </pre>
          )}
        </>
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
