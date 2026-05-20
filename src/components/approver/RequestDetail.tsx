import { RequestDetailView } from "../RequestDetailView";
import { DecisionPanel } from "./DecisionPanel";
import { REQUEST_STATUS } from "../../types/domain";

export function RequestDetail({
  requestId,
  onBack,
}: {
  requestId: string;
  onBack: () => void;
}) {
  return (
    <RequestDetailView
      requestId={requestId}
      onBack={onBack}
      renderFooter={(request, reload) =>
        request.statusCode === REQUEST_STATUS.Pending ||
        request.statusCode === REQUEST_STATUS.MoreInfo ? (
          <>
            <h3>Decision</h3>
            <DecisionPanel
              requestId={request.id}
              directedTo={request.createdByName ?? ""}
              onDecided={reload}
            />
          </>
        ) : (
          <p className="empty">
            This request has been resolved. No further actions.
          </p>
        )
      }
    />
  );
}
