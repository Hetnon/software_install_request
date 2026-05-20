import type { SoftwareRequest } from "../../types/domain";
import { StatusPill } from "../StatusPill";

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

export function RequestsTable({
  requests,
  onSelect,
  showResolvedColumn = true,
}: {
  requests: SoftwareRequest[];
  onSelect: (id: string) => void;
  showResolvedColumn?: boolean;
}) {
  return (
    <table className="data-table data-table--clickable">
      <thead>
        <tr>
          <th>Request</th>
          <th>Software</th>
          <th>Requester</th>
          <th>Opened</th>
          {showResolvedColumn && <th>Resolved</th>}
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {requests.map((r) => (
          <tr key={r.id} onClick={() => onSelect(r.id)}>
            <td>{r.key}</td>
            <td>{r.softwareName ?? "—"}</td>
            <td>{r.createdByName ?? "—"}</td>
            <td>{formatDate(r.createdOn)}</td>
            {showResolvedColumn && <td>{formatDate(r.dateResolved)}</td>}
            <td><StatusPill status={r.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
