import { useState } from "react";
import { useAsync } from "../../hooks/useAsync";
import { listActive } from "../../lib/software";
import { create } from "../../lib/requests";
import { Loading } from "../Loading";
import { ErrorBanner } from "../ErrorBanner";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; error: Error };

export function NewRequestForm({
  onSubmitted,
}: {
  onSubmitted?: () => void;
}) {
  const software = useAsync(() => listActive(), []);
  const [softwareId, setSoftwareId] = useState<string>("");
  const [justification, setJustification] = useState<string>("");
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });

  if (software.loading) return <Loading label="Loading software catalog..." />;
  if (software.error) return <ErrorBanner error={software.error} />;
  if (!software.data || software.data.length === 0) {
    return <p className="empty">No active software is available to request.</p>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!softwareId) return;
    setSubmit({ status: "submitting" });
    try {
      await create({
        softwareId,
        justification: justification.trim() || undefined,
      });
      setSoftwareId("");
      setJustification("");
      setSubmit({ status: "idle" });
      onSubmitted?.();
    } catch (err) {
      setSubmit({
        status: "error",
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  const disabled = submit.status === "submitting" || !softwareId;

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="software">Software</label>
        <select
          id="software"
          required
          value={softwareId}
          onChange={(e) => setSoftwareId(e.target.value)}
          disabled={submit.status === "submitting"}
        >
          <option value="">Select software...</option>
          {software.data.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="justification">Justification</label>
        <textarea
          id="justification"
          rows={5}
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Why do you need this software?"
          disabled={submit.status === "submitting"}
        />
      </div>

      {submit.status === "error" && <ErrorBanner error={submit.error} />}

      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={disabled}>
          {submit.status === "submitting" ? "Submitting..." : "Submit request"}
        </button>
      </div>
    </form>
  );
}
