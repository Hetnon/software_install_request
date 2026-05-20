import { useAsync } from "../../hooks/useAsync";
import { listPending } from "../../lib/requests";
import { Loading } from "../Loading";
import { ErrorBanner } from "../ErrorBanner";
import { RequestsTable } from "./RequestsTable";

export function PendingRequestsList({
  onSelect,
}: {
  onSelect: (requestId: string) => void;
}) {
  const requests = useAsync(() => listPending(), []);

  if (requests.loading) return <Loading label="Loading pending requests..." />;
  if (requests.error) return <ErrorBanner error={requests.error} />;
  if (!requests.data || requests.data.length === 0) {
    return <p className="empty">No requests are awaiting approval.</p>;
  }

  return (
    <RequestsTable
      requests={requests.data}
      onSelect={onSelect}
      showResolvedColumn={false}
    />
  );
}
