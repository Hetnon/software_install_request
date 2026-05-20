import type { ReactNode } from "react";
import { useAsync } from "../hooks/useAsync";
import { get } from "../lib/requests";
import { listForRequest } from "../lib/messages";
import type { SoftwareRequest } from "../types/domain";
import { Loading } from "./Loading";
import { ErrorBanner } from "./ErrorBanner";
import { StatusPill } from "./StatusPill";

function formatDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function RequestDetailView({
  requestId,
  onBack,
  renderFooter,
}: {
  requestId: string;
  onBack: () => void;
  renderFooter?: (request: SoftwareRequest, reload: () => void) => ReactNode;
}) {
  const request = useAsync(() => get(requestId), [requestId]);
  const messages = useAsync(() => listForRequest(requestId), [requestId]);

  const reloadAll = () => {
    request.reload();
    messages.reload();
  };

  return (
    <section>
      <button type="button" className="btn" onClick={onBack}>
        ← Back
      </button>

      {request.loading && <Loading label="Loading request..." />}
      {request.error && <ErrorBanner error={request.error} />}

      {request.data && (
        <>
          <header className="detail-header">
            <h2>{request.data.key}</h2>
            <StatusPill status={request.data.status} />
          </header>

          <dl className="detail-grid">
            <dt>Software</dt>
            <dd>{request.data.softwareName ?? "—"}</dd>
            <dt>Requester</dt>
            <dd>{request.data.createdByName ?? "—"}</dd>
            <dt>Opened</dt>
            <dd>{formatDateTime(request.data.createdOn)}</dd>
            <dt>Resolved</dt>
            <dd>{formatDateTime(request.data.dateResolved)}</dd>
            <dt>Justification</dt>
            <dd>{request.data.justification?.trim() || "(none)"}</dd>
          </dl>

          <h3>Messages</h3>
          {messages.loading && <Loading label="Loading messages..." />}
          {messages.error && <ErrorBanner error={messages.error} />}
          {messages.data && messages.data.length === 0 && (
            <p className="empty">No messages yet.</p>
          )}
          {messages.data && messages.data.length > 0 && (
            <ul className="message-list">
              {messages.data.map((m) => (
                <li key={m.id} className="message">
                  <div className="message-meta">
                    <strong>{m.createdByName ?? "Unknown"}</strong>
                    <span>{formatDateTime(m.createdOn)}</span>
                  </div>
                  <div className="message-body">{m.body}</div>
                </li>
              ))}
            </ul>
          )}

          {renderFooter?.(request.data, reloadAll)}
        </>
      )}
    </section>
  );
}
