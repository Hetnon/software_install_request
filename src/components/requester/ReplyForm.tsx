import { useState } from "react";
import { send } from "../../lib/messages";
import { ErrorBanner } from "../ErrorBanner";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; error: Error };

export function ReplyForm({
  requestId,
  directedTo,
  onSent,
}: {
  requestId: string;
  directedTo: string;
  onSent: () => void;
}) {
  const [body, setBody] = useState<string>("");
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setState({ status: "submitting" });
    try {
      await send({ requestId, body: trimmed, directedTo });
      setBody("");
      setState({ status: "idle" });
      onSent();
    } catch (err) {
      setState({
        status: "error",
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  const busy = state.status === "submitting";

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="reply">Message</label>
        <textarea
          id="reply"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a message..."
          disabled={busy}
        />
      </div>

      {state.status === "error" && <ErrorBanner error={state.error} />}

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn--primary"
          disabled={busy || body.trim().length === 0}
        >
          {busy ? "Sending..." : "Send"}
        </button>
      </div>
    </form>
  );
}
