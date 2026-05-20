import { useState } from "react";
import { reopen } from "../../lib/requests";
import { ErrorBanner } from "../ErrorBanner";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; error: Error };

export function ReopenButton({
  requestId,
  onReopened,
}: {
  requestId: string;
  onReopened: () => void;
}) {
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  async function handleClick() {
    setState({ status: "submitting" });
    try {
      await reopen(requestId);
      setState({ status: "idle" });
      onReopened();
    } catch (err) {
      setState({
        status: "error",
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  const busy = state.status === "submitting";

  return (
    <div>
      <div className="form-actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={handleClick}
        >
          {busy ? "Working..." : "Move back to pending"}
        </button>
      </div>
      {state.status === "error" && <ErrorBanner error={state.error} />}
    </div>
  );
}
