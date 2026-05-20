import { useState } from "react";
import type { SdkUser } from "../lib/sdk";
import { MyRequestsList } from "../components/requester/MyRequestsList";
import { NewRequestForm } from "../components/requester/NewRequestForm";
import { MyRequestDetail } from "../components/requester/MyRequestDetail";

type Tab = "mine" | "new";

export function RequesterScreen({ user }: { user: SdkUser }) {
  const [tab, setTab] = useState<Tab>("mine");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!user.objectId) {
    return (
      <p className="empty">
        Cannot resolve your user object ID from the Power Apps context.
      </p>
    );
  }

  function changeTab(next: Tab) {
    setTab(next);
    setSelectedId(null);
  }

  if (selectedId) {
    return (
      <MyRequestDetail
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
          aria-selected={tab === "mine"}
          className={tab === "mine" ? "tab tab--active" : "tab"}
          onClick={() => changeTab("mine")}
        >
          My Requests
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "new"}
          className={tab === "new" ? "tab tab--active" : "tab"}
          onClick={() => changeTab("new")}
        >
          New Request
        </button>
      </nav>

      <div className="tab-panel">
        {tab === "mine" ? (
          <MyRequestsList userObjectId={user.objectId} onSelect={setSelectedId} />
        ) : (
          <NewRequestForm onSubmitted={() => changeTab("mine")} />
        )}
      </div>
    </section>
  );
}
