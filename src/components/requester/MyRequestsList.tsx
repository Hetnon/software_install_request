import { useAsync } from "../../hooks/useAsync";
import { listMine } from "../../lib/requests";
import { Loading } from "../Loading";
import { ErrorBanner } from "../ErrorBanner";
import { StatusPill } from "../StatusPill";

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

export function MyRequestsList({
  userObjectId,
  onSelect,
}: {
  userObjectId: string;
  onSelect: (requestId: string) => void;
}) {
  const requests = useAsync(() => listMine(userObjectId), [userObjectId]);

  if (requests.loading) return <Loading label="Loading your requests..." />;
  if (requests.error) return <ErrorBanner error={requests.error} />;
  if (!requests.data || requests.data.length === 0) {
    return <p className="empty">You haven't submitted any requests yet.</p>;
  }

  return (
    <table className="data-table data-table--clickable">
      <thead>
        <tr>
          <th>Request</th>
          <th>Software</th>
          <th>Opened</th>
          <th>Resolved</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {requests.data.map((r) => (
          <tr key={r.id} onClick={() => onSelect(r.id)}>
            <td>{r.key}</td>
            <td>{r.softwareName ?? "—"}</td>
            <td>{formatDate(r.createdOn)}</td>
            <td>{formatDate(r.dateResolved)}</td>
            <td><StatusPill status={r.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
