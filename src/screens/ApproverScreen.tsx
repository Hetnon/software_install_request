import { useState } from "react";
import type { SdkUser } from "../lib/sdk";
import { PendingRequestsList } from "../components/approver/PendingRequestsList";
import { AllRequestsList } from "../components/approver/AllRequestsList";
import { RequestDetail } from "../components/approver/RequestDetail";

type Tab = "pending" | "all";

export function ApproverScreen({ user: _user }: { user: SdkUser }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("pending");

  if (selectedId) {
    return (
      <RequestDetail
        requestId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <section>
      <nav className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "pending"}
          className={tab === "pending" ? "tab tab--active" : "tab"}
          onClick={() => setTab("pending")}
        >
          Pending
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "all"}
          className={tab === "all" ? "tab tab--active" : "tab"}
          onClick={() => setTab("all")}
        >
          All requests
        </button>
      </nav>

      <div className="tab-panel">
        {tab === "pending" ? (
          <PendingRequestsList onSelect={setSelectedId} />
        ) : (
          <AllRequestsList onSelect={setSelectedId} />
        )}
      </div>
    </section>
  );
}
