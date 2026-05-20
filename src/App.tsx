import { useEffect, useState } from "react";
import { usePowerAppsContext } from "./lib/sdk";
import { getRoleForUser, type Role } from "./lib/role";
import { RequesterScreen } from "./screens/RequesterScreen";
import { ApproverScreen } from "./screens/ApproverScreen";
import { Loading } from "./components/Loading";
import { ErrorBanner } from "./components/ErrorBanner";
import "./App.css";

const ROLE_OVERRIDE_KEY = "role-override";

function readStoredRole(): Role | null {
  const v = localStorage.getItem(ROLE_OVERRIDE_KEY);
  return v === "requester" || v === "approver" ? v : null;
}

export default function App() {
  const sdk = usePowerAppsContext();
  const [role, setRole] = useState<Role | null>(null);
  const [roleError, setRoleError] = useState<Error | null>(null);

  useEffect(() => {
    if (sdk.status !== "ready") return;
    const stored = readStoredRole();
    if (stored) {
      setRole(stored);
      return;
    }
    let cancelled = false;
    getRoleForUser(sdk.context.user).then(
      (r) => {
        if (!cancelled) setRole(r);
      },
      (e) => {
        if (!cancelled) {
          setRoleError(e instanceof Error ? e : new Error(String(e)));
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [sdk]);

  function switchRole(next: Role) {
    localStorage.setItem(ROLE_OVERRIDE_KEY, next);
    setRole(next);
  }

  if (sdk.status === "initializing") {
    return (
      <div className="app">
        <Loading label="Initializing Power Apps SDK..." />
      </div>
    );
  }
  if (sdk.status === "error") {
    return (
      <div className="app">
        <ErrorBanner error={sdk.error} />
      </div>
    );
  }
  if (roleError) {
    return (
      <div className="app">
        <ErrorBanner error={roleError} />
      </div>
    );
  }
  if (!role) {
    return (
      <div className="app">
        <Loading label="Resolving role..." />
      </div>
    );
  }

  const user = sdk.context.user;
  return (
    <div className="app">
      <header className="app-header">
        <h1>Software Requests</h1>
        <div className="user-chip">
          <span>{user.fullName ?? user.userPrincipalName ?? "Unknown user"}</span>
          <div className="role-switch" role="group" aria-label="View as">
            <button
              type="button"
              className={role === "requester" ? "role-switch__btn role-switch__btn--active" : "role-switch__btn"}
              onClick={() => switchRole("requester")}
            >
              Requester
            </button>
            <button
              type="button"
              className={role === "approver" ? "role-switch__btn role-switch__btn--active" : "role-switch__btn"}
              onClick={() => switchRole("approver")}
            >
              Approver
            </button>
          </div>
        </div>
      </header>
      <main className="app-main">
        {role === "approver" ? (
          <ApproverScreen user={user} />
        ) : (
          <RequesterScreen user={user} />
        )}
      </main>
    </div>
  );
}
