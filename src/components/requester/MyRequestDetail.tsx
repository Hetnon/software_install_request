import { RequestDetailView } from "../RequestDetailView";
import { ReplyForm } from "./ReplyForm";
import { ReopenButton } from "./ReopenButton";
import { REQUEST_STATUS } from "../../types/domain";

export function MyRequestDetail({
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
      renderFooter={(request, reload) => (
        <>
          <h3>Send a message</h3>
          <ReplyForm
            requestId={request.id}
            directedTo={request.approverName ?? "Approver"}
            onSent={reload}
          />

          {request.statusCode === REQUEST_STATUS.Rejected && (
            <>
              <h3>Reopen</h3>
              <p>
                This request was rejected. If circumstances have changed, you
                can move it back to the pending queue for re-review.
              </p>
              <ReopenButton requestId={request.id} onReopened={reload} />
            </>
          )}
        </>
      )}
    />
  );
}
