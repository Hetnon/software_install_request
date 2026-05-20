import type { RequestStatusLabel } from "../types/domain";

export function StatusPill({
  status,
}: {
  status: RequestStatusLabel | "Unknown";
}) {
  return (
    <span className="status-pill" data-status={status}>
      {status}
    </span>
  );
}
