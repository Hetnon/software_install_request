import { useAsync } from "../../hooks/useAsync";
import { listAll } from "../../lib/requests";
import { Loading } from "../Loading";
import { ErrorBanner } from "../ErrorBanner";
import { RequestsTable } from "./RequestsTable";

export function AllRequestsList({
  onSelect,
}: {
  onSelect: (requestId: string) => void;
}) {
  const requests = useAsync(() => listAll(), []);

  if (requests.loading) return <Loading label="Loading requests..." />;
  if (requests.error) return <ErrorBanner error={requests.error} />;
  if (!requests.data || requests.data.length === 0) {
    return <p className="empty">No requests have been submitted yet.</p>;
  }

  return <RequestsTable requests={requests.data} onSelect={onSelect} />;
}
