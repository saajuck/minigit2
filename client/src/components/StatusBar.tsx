import type { StatusResponse } from "@minigit2/shared";

interface Props {
  status: StatusResponse | null;
}

export default function StatusBar({ status }: Props) {
  if (!status) return null;

  return (
    <div className="status-bar">
      {status.detached ? (
        <span className="branch detached">HEAD détaché @ {status.headCommit?.slice(0, 7) ?? "?"}</span>
      ) : (
        <span className="branch">{status.branch ?? "(pas encore de commit)"}</span>
      )}
      {status.dirty && (
        <span className="dirty">
          modifications non commitées ({status.staged} staged, {status.unstaged} unstaged, {status.untracked}{" "}
          untracked)
        </span>
      )}
    </div>
  );
}
