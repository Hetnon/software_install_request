# Project context

State of the Software Request & Approval Code App as of the prototype session.
Read alongside `CONNECT.md` (how to wire / re-wire the project) and `README.md` (Vite default).

## What this app is

A Power Apps **Code App** (React + TypeScript + Vite, deployed via Power Platform runtime, backed by Dataverse) that lets employees request software and lets approvers triage those requests.

End-user flows:

- **Requester:** see their own requests, submit a new one, click into any to see the message thread, send replies, and reopen a Rejected request.
- **Approver:** see Pending queue (default) or All requests; click into any to see details + thread, then Approve / Reject / Request more info with an optional comment.

## Architecture

- **Auth + identity:** Power Apps SDK (`@microsoft/power-apps`) via `app.setConfig` + `app.getContext`. Entra SSO; user info comes back as `IUserContext`.
- **Data:** Dataverse-only. Three custom tables (see Schema below). All reads/writes go through the auto-generated services in `src/generated/services/`.
- **UI routing:** no router lib — single SPA with internal `useState` switching between two screens (Requester / Approver) and within each, list ↔ detail.
- **Role detection seam:** `src/lib/role.ts` returns `'requester' | 'approver'`. Demo body uses a hardcoded UPN allowlist (`src/config/approvers.ts`); production swaps in a Graph group-membership check (see TODOs).

## File map

```
src/
├── main.tsx                              entry; calls initSdk() then mounts
├── App.tsx                               SDK-init gate → role gate → screen + "View as" toggle
├── App.css, index.css                    full restyle (clean business theme)
├── types/domain.ts                       UI-shaped types + RequestStatus enum (numeric ↔ label)
├── config/approvers.ts                   APPROVER_UPNS allowlist (demo only)
├── lib/
│   ├── sdk.ts                            initSdk + usePowerAppsContext hook
│   ├── role.ts                           getRoleForUser (hardcoded body, Graph-ready signature)
│   ├── odata.ts                          unwrap(), bind(), readFormatted() (annotations)
│   ├── software.ts                       listActive (statecode eq 0)
│   ├── requests.ts                       listMine / listPending / listAll / get / create / decide / reopen
│   └── messages.ts                       listForRequest / send
├── hooks/useAsync.ts                     generic { data, loading, error, reload }
├── screens/
│   ├── RequesterScreen.tsx               My Requests ↔ New Request tabs, list ↔ detail
│   └── ApproverScreen.tsx                Pending ↔ All tabs, list ↔ detail
└── components/
    ├── Loading.tsx, ErrorBanner.tsx, StatusPill.tsx
    ├── RequestDetailView.tsx             shared: back + header + grid + thread + slot
    ├── requester/
    │   ├── MyRequestsList.tsx, NewRequestForm.tsx
    │   ├── MyRequestDetail.tsx           plugs ReplyForm + ReopenButton into RequestDetailView
    │   ├── ReplyForm.tsx                 textarea + send → writes to Messages
    │   └── ReopenButton.tsx              Rejected → Pending + clears date_resolved
    └── approver/
        ├── RequestsTable.tsx             shared presentational table
        ├── PendingRequestsList.tsx, AllRequestsList.tsx
        ├── RequestDetail.tsx             plugs DecisionPanel into RequestDetailView
        └── DecisionPanel.tsx             Approve / Reject / Request more info
```

## Dataverse schema (current state)

Three custom tables with logical names. Schema files in `.power/schemas/dataverse/`.

### `cr108_request`
| Column | Type | Notes |
|---|---|---|
| `cr108_requestid` | GUID (PK) | system |
| `cr108_key` | text | primary name; populated manually with `REQ-${Date.now()}` |
| `cr108_software` | Lookup → cr108_software | required; bound via `@odata.bind` |
| `cr108_justification` | multiline text | optional |
| `cr108_status` | Choice | Approved=1, Rejected=2, MoreInfo=3, **Pending=4** (added during prototype) |
| `cr108_approver_admin` | Lookup → systemuser | optional after schema fix; **not currently set by the app** (see TODOs) |
| `cr108_date_resolved` | DateTime | optional after schema fix; set on Approve/Reject, cleared on reopen |
| `cr108_shared_id` | int | unused |
| `cr108_requester` (= `zz_requester_old`) | text | legacy; unused — system `createdby` identifies the requester |

### `cr108_software`
| Column | Type | Notes |
|---|---|---|
| `cr108_softwareid` | GUID (PK) | system |
| `cr108_name` | text | primary name; the only column the app uses |
| (vendor, license_type, active flag) | — | **not present** — see TODOs if you want to display them |

### `cr108_messages` (entity set `cr108_messageses` — Dataverse pluralized the already-plural name)
| Column | Type | Notes |
|---|---|---|
| `cr108_messagesid` | GUID (PK) | system |
| `cr108_message_key` | text | primary name; populated with `MSG-${Date.now()}` |
| `cr108_message` | multiline text | body |
| `cr108_directed_to` | text | recipient display name; falls back to "Approver" when not known |
| `cr108_request` | Lookup → cr108_request | bound via `@odata.bind` |

## Schema changes made during the prototype

1. Added `Pending = 4` to the `cr108_status` choice (was missing).
2. Made `cr108_approver_admin` optional (was required → blocked Pending creates).
3. Made `cr108_date_resolved` optional (same reason).
4. Re-ran `pac code add-data-source` after each change to regenerate `src/generated/`.

## OData / SDK quirks discovered

- **Lookup display names are not selectable.** The generated model lists `cr108_softwarename` etc., but Dataverse rejects them in `$select`. Read them from `_<lookup>_value@OData.Community.Display.V1.FormattedValue` annotations instead. Helper: `readFormatted()` in `src/lib/odata.ts`.
- **Lookup writes use `@odata.bind`.** Syntax: `{ "cr108_software@odata.bind": "/cr108_softwares(<guid>)" }`. Helper: `bind()` in `src/lib/odata.ts`.
- **Filter by current user.** `listMine` uses `createdby/azureactivedirectoryobjectid eq <objectId>` — Dataverse OData navigation filter. Avoids needing `systemuser` as a data source.
- **The generated `create` type is over-strict** — it demands `ownerid` / `owneridtype` / `statecode` even though Dataverse fills them automatically. Worked around with `as unknown as Omit<…>` casts inside `lib/requests.ts` and `lib/messages.ts`.
- **`pac code` table name = singular logical name** (`cr108_request`, not `cr108_requests`).

## Demo workarounds in the code (must be cleaned up for production)

These are intentional, marked here so they don't get forgotten.

1. **"View as Requester / Approver" header toggle.** Lets a single user (the maker) test both flows from one account because the env is a Developer env (single-user). Lives in `src/App.tsx` (`localStorage["role-override"]`).
2. **Hardcoded approver UPN list** in `src/config/approvers.ts`. Used by `src/lib/role.ts:getRoleForUser`.
3. **`cr108_approver_admin` is never set.** `decide()` only updates status + date_resolved. Audit trail relies on the system `modifiedby` field. Setting the lookup would require the approver's *systemuser* GUID, which means adding the `systemuser` table as a data source — deferred.
4. **`cr108_directed_to` falls back to the literal string `"Approver"`** when the requester replies — because `cr108_approver_admin` isn't set (see point 3), so the formatted display name is empty.
5. **Status flip on requester reply is not automatic.** Replying to a MoreInfo request adds a message but doesn't move the request back to Pending. The approver sees the new message and re-decides manually.

## What's still missing for production

### Environment
- [ ] Move out of the Developer environment. Provision Sandbox + Production (or at minimum Default with Dataverse) and migrate the three tables + the app.
- [ ] Confirm region matches client compliance requirements (currently `prod` / Australia per `power.config.json`).
- [ ] Set up Power Platform pipelines or GitHub Actions for dev → test → prod promotion.

### Licensing
- [ ] Decide between Power Apps Premium, Pay-as-you-go, or per-app for end users (see proposal doc).
- [ ] Assign licenses to all users in scope.
- [ ] Auto-claim or manual license assignment process.

### Auth / role detection
- [ ] Create Entra security group `SoftwareRequest-Approvers`.
- [ ] Replace hardcoded UPN list in `src/lib/role.ts` with a Graph `/me/memberOf` (or `/me/checkMemberGroups`) call against that group. Needs Graph token plumbing (MSAL.js or custom connector — the Power Apps SDK does not expose a Graph token).
- [ ] Remove the "View as" toggle from `src/App.tsx` and the localStorage key it uses.

### Dataverse security
- [ ] Create two custom security roles: `SoftwareRequest-Requester` (Read/Create on Request and Messages; Read on Software) and `SoftwareRequest-Approver` (Read/Update on Request; Read/Create on Messages; Read on Software).
- [ ] Assign roles to all users in the env.
- [ ] Decide whether to enable Dataverse auditing on the three tables (full who-changed-what log).

### Audit trail
- [ ] Add `systemuser` as a data source.
- [ ] In `decide()`, look up the approver's systemuser ID via `azureactivedirectoryobjectid eq <objectId>` and bind `cr108_approver_admin@odata.bind` so the field has real data instead of relying on `modifiedby`.

### Schema polish (optional)
- [ ] Add `cr108_vendor`, `cr108_license_type`, `cr108_active` to the Software table if those need to surface in the UI.
- [ ] Drop or hide the unused legacy `cr108_requester` (= `zz_requester_old`) column on Request.
- [ ] Consider making `cr108_directed_to` on Messages optional, or change it to a lookup to systemuser (would also need `systemuser` as a data source).

### UX polish
- [ ] Auto-flip a MoreInfo request back to Pending when the requester sends a reply (one-line addition in `lib/messages.ts:send` or a dedicated `replyAndReopen()` helper).
- [ ] Notification badge on the approver header when new messages arrive on Pending/MoreInfo requests.
- [ ] App branding: name, icon, color scheme.
- [ ] Empty-state illustrations / better copy.

### Notifications (separate workstream)
- [ ] Power Automate flow: on Request status change → email or Teams card to the requester.
- [ ] Power Automate flow: on Request create → email or Teams card to the approver group.
- [ ] These do not require code changes — they're configured against the Dataverse table directly.

### Deployment / hosting
- [ ] Decide launch surface: SharePoint embedded, Teams app/tab, or direct link from the client's intranet.
- [ ] Share the app with users (Power Apps sharing) separately from Dataverse roles — both gates must be set.
- [ ] DLP policy review with the client's Power Platform admin team.

### Observability
- [ ] App Insights or Power Platform telemetry hookup for usage + errors.
- [ ] Decide retention period for audit logs and message history.

## Open questions for the client

These need answers before we can scope and ship the production version. (Mirror of the proposal doc — duplicated here so future-you doesn't have to dig.)

1. Sandbox + Production Dataverse environments — do they exist, or do we need to request them?
2. Final user count (requesters + approvers) for licensing decision.
3. Launch surface: SharePoint, Teams, or direct link?
4. Notifications: scope in or out?
5. Approval / sign-off path before going live (Power Platform admin? CoE? IT security? Compliance?)

## Quick verification commands

```powershell
# Type-check the whole project
npx tsc -b

# Local dev (against the connected env)
npm run dev

# Production build (sanity check)
npm run build

# Push to the connected env
pac code push

# Refresh generated types after a Dataverse schema change
pac code add-data-source --tableName cr108_request
pac code add-data-source --tableName cr108_software
pac code add-data-source --tableName cr108_messages
```
