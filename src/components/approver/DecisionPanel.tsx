import { useState } from "react";
import { decide, type DecisionOutcome } from "../../lib/requests";
import { send } from "../../lib/messages";
import { ErrorBanner } from "../ErrorBanner";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; error: Error };

export function DecisionPanel({
  requestId,
  directedTo,
  onDecided,
}: {
  requestId: string;
  directedTo: string;
  onDecided: () => void;
}) {
  const [comment, setComment] = useState<string>("");
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  async function submit(outcome: DecisionOutcome) {
    const trimmed = comment.trim();
    if (outcome === "requestMoreInfo" && trimmed.length === 0) {
      setState({
        status: "error",
        error: new Error("A comment is required when requesting more info."),
      });
      return;
    }
    setState({ status: "submitting" });
    try {
      if (trimmed.length > 0) {
        await send({ requestId, body: trimmed, directedTo });
      }
      await decide({ id: requestId, outcome });
      setComment("");
      setState({ status: "idle" });
      onDecided();
    } catch (err) {
      setState({
        status: "error",
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  const busy = state.status === "submitting";

  return (
    <div className="decision-panel">
      <div className="field">
        <label htmlFor="comment">Comment (required when requesting more info)</label>
        <textarea
          id="comment"
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a note for the requester..."
          disabled={busy}
        />
      </div>

      {state.status === "error" && <ErrorBanner error={state.error} />}

      <div className="form-actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={() => submit("approve")}
        >
          {busy ? "Working..." : "Approve"}
        </button>
        <button
          type="button"
          className="btn btn--danger"
          disabled={busy}
          onClick={() => submit("reject")}
        >
          Reject
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => submit("requestMoreInfo")}
        >
          Request more info
        </button>
      </div>
    </div>
  );
}
