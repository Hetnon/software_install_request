# Software Request & Approval Platform — Solution Architecture

> **Document control**
> Version: 0.2 (draft, internal)
> Status: For client review — high-level only
> Author: Solutions Architecture
> Date: 2026-05-20
> Companion artefact: `HighLevelDesign.drawio` (same folder)

---

## 1. Purpose

This document captures the proposed solution architecture for the **Software Request & Approval Platform**: a tracked workflow for employees to request software that **requires a license**, have it reviewed and approved, and have its installation recorded against the request.

The platform exists to **keep licensed-software requests separate from the everyday flow** where the same employees self-install free / unlicensed software without justification. Licensed software needs auditable justification, an explicit approver decision, a record of what was approved for whom, and a record of when the installation actually happened. The free-install flow does not need any of that and is out of scope.

Provisioning the approved software onto the user's device remains an operational task carried out by IT through the client's existing channels (Intune, manual install, scripted deployment — whichever the client already uses). The platform's role in installation is to **dispatch and track** it: notify the right team when a request is approved, accept confirmation that the install happened, attach that confirmation to the request, and close the loop on the audit trail.

**Out of scope**: The platform itself does not build, scan, sign or push software to endpoints.

This document records:

- Architecture decisions already made (with rationale)
- Components and how they fit together
- Cross-cutting concerns (security, audit, ALM, observability)
- Open discussion points that still need a client decision
- A roadmap of the lower-level design artefacts we will produce after this high-level design is signed off

The Confluence import flow is: paste this file's contents into a new Confluence page using **Insert → Markdown**. The draw.io file can be attached to the page and opened with the *draw.io for Confluence* app, or exported to PNG for inline embedding.

---

## 2. Scope

### 2.1 In scope (this architecture)

- Requester UI: software request form with name, version, license type, justification & evidence (rich text + attachments), and metadata auto-fill
- Approver UI: queue, decision panel (Approve / Reject / Request more info), comments, audit log view, evidence view
- Dataverse data model covering Requests, Software catalog, Messages, Approval history, Workflow States, Audit Logs, Install Events
- Power Automate workflows: sequential approval, SLA timers, reminders, auto-escalation, rejection paths, notification fan-out, install dispatch + confirmation
- Notifications via Exchange (email) and Microsoft Teams
- Install handoff: on Approved, notify the install team with the request payload; capture their install-confirmed (or install-failed) signal; attach it to the request and close the loop
- Platform CI/CD pipeline (Azure DevOps) for building and releasing **the Code App itself** — checkout, lint, test, npm-dependency SBOM/vuln scan, `pac code push` to the target environment
- Identity, role, governance and audit-trail design across all layers

### 2.2 Out of scope (for v1)

- Automated provisioning of the requested software (build, scan, sign, push to endpoints) — this is performed by the install team through the client's existing channels; the platform only tracks the outcome
- WDAC / AppLocker / endpoint-execution-control authoring or distribution
- Direct integration with the eProcurement system (only attachments / URL references are captured on the form)
- Cost recovery / chargeback to requesting cost centres
- Self-service uninstall and renewal workflows
- The free / unlicensed software self-install flow (handled outside this platform by design)

---

## 3. Architecture decisions already made

| # | Decision | Rationale |
|---|---|---|
| AD-01 | **Power Apps Code Apps** (React 19 + TypeScript + Vite, `@microsoft/power-apps` SDK) for the UI layer | First-party Microsoft (GA 2026-02-05). Inherits Entra SSO, Dataverse, governance, security, and licensing. Code-first productivity (component reuse, source control, automated testing) with no new compliance surface. |
| AD-02 | **Dataverse** as the system of record for all request, workflow, audit and install-tracking data | Same tenant, same auth as the UI; Microsoft-managed; native audit + change-tracking; OData query surface that the SDK already targets. No separate database to operate. |
| AD-03 | **Power Automate** as the workflow engine (approvals, timers, escalation, notifications, install dispatch) | Native Dataverse triggers, native Teams/Outlook connectors. No custom orchestration code to maintain. |
| AD-04 | **Install handoff by notification + confirmation, not by automated provisioning** | The platform notifies the install team on Approved and waits for a confirmation signal back; provisioning itself stays with IT's existing tooling. Keeps the platform decoupled from whatever endpoint-management stack the client runs today and tomorrow. |
| AD-05 | **One combined "Justification & evidence" field** on the request form (rich text + multi-attachment) instead of separate `justification` + `entitlement_evidence_url` fields | Matches how requesters actually write ("I need X because Y, see attached PO / screenshot / link"). Simpler UX; one field; takes whatever evidence the requester wants to drop in. Trade-off: no structured "evidence-present yes/no" metric (acceptable for v1). |
| AD-06 | **Platform CI/CD via Azure DevOps**, scoped to the Code App itself (lint, test, npm SBOM/vuln scan, `pac code push`) | YAML-defined pipeline the client can version-control and audit. ADO already in use at the client. Distinct from any pipeline that processes requested software (which is out of scope — see §8.1). |
| AD-07 | **Entra security group** as the source of truth for role membership (approver vs. requester) | One source IT already manages. The app checks group membership via Microsoft Graph at sign-in. Anyone not in the group is a requester by default. Chosen over a Dataverse-table or security-role-read approach (see §8). |
| AD-08 | **Dataverse custom security roles** (`SoftwareRequest-Requester`, `SoftwareRequest-Approver`) for table-level authorisation | Defence in depth: the UI gates by Entra group, but the data layer also enforces who can read/write what. Group membership alone is not enough. |
| AD-09 | **Sequential approval** with timers, reminders and auto-escalation in v1 (single approver group) | Matches the stated requirement. Multi-stage / multi-approver routing is a v2 candidate. |
| AD-10 | **Three-decision model** on the approver form: Approve / Reject / Request more info | More-info routes the request back to the requester through the message thread; the request stays open. Reject is terminal but can be reopened by the requester. |
| AD-11 | **Per-request message thread** stored in Dataverse | Captures requester ↔ approver dialogue alongside the audit trail. Used for the More-info loop and for surfacing install-team responses. |
| AD-12 | **Three Dataverse environments** for ALM: Dev → Test → Production (minimum Sandbox + Production) | The Developer environment used for the prototype is single-user by design and cannot host the live app. |
| AD-13 | **TypeScript strict mode**, no `any`, no hand-written Dataverse fetches | All Dataverse calls go through the SDK-generated services in `src/generated/`. The generated folder is never hand-edited. |

---

## 4. Solution overview

See `HighLevelDesign.drawio`, page 1. *(Diagram still reflects v0.1 — to be redrawn against this rescope; see §11.)*

A signed-in employee opens the Power Apps Code App. The app authenticates them via Entra SSO, then checks Entra group membership through Microsoft Graph: members of `SoftwareRequest-Approvers` see the approver experience; everyone else sees the requester experience.

A requester submits a software request — name, version, license type, and a combined Justification & evidence field (rich text + attachments such as a PO screenshot, an eProcurement link, a vendor quote). The submission writes a row to the Dataverse **Request** table. A Power Automate flow fires on the row insert: it records the initial workflow state, sends the approver group a Teams card and email, and starts the SLA timer.

The approver opens the same app, picks the request from their pending queue, and either Approves, Rejects, or asks for More Info. The decision is written back to Dataverse; the audit trail records who decided when. *Request more info* puts the request in a non-terminal state where the requester and approver exchange messages until the approver re-decides. Rejection can be reversed by the requester (move back to Pending).

On **Approve**, Power Automate moves the request to the *Awaiting install* state and notifies the install team (the IT group that provisions software via the client's existing channels — typically Intune, but the platform does not assume any specific tool). The notification carries the request payload: who, what software/version, justification, evidence, and the approver's comments.

The install team carries out the provisioning in their own tooling, then signals back to the platform that the install has completed — either by clicking a confirmation link in the notification, or by an authorised user updating the request in the app. The platform records this as an **InstallEvent** (dispatched, confirmed, failed) and moves the request to its terminal *Installed* state. A failed install routes back through the message thread the request and approval already use.

Every status transition is written to the audit log so the full *request → approval → install* timeline is reconstructable from Dataverse alone.

---

## 5. Components

### 5.1 Identity & Access (Entra ID)

- **Entra ID** is the tenant identity provider. All authentication is Entra SSO.
- **`SoftwareRequest-Approvers` security group** — single source of truth for who is an approver. Membership is managed in the existing IT process for security-group changes.
- **Microsoft Graph** — the Code App calls `/me/memberOf` (or `/me/checkMemberGroups`) at sign-in to determine the user's role. A token-acquisition seam (MSAL.js inside the Code App, or a thin Power Automate / custom connector wrapper) is required because the Power Apps SDK does not expose a Graph token directly.

### 5.2 Presentation Layer — Power Apps Code App

- React 19 + TypeScript + Vite, deployed through `pac code push`.
- Served by the Microsoft-managed Power Platform runtime — no separate hosting to operate.
- Components: Requester form, My-Requests list & detail, Approver queue (Pending + All), Approver detail with Decision panel, message thread, audit view.
- All data access goes through SDK-generated services (`src/generated/services/`), which target Dataverse OData. No raw fetch calls.
- Strict TypeScript, no `any`. SDK init is gated on `isInitialized` before any UI renders.

### 5.3 Workflow Layer — Power Automate

Four flows (detail on page 4 of the diagram, deferred):

1. **Approval orchestration** — fires on Request row insert; sets initial workflow state; sends approver notifications; starts SLA timer; sends reminders; auto-escalates on timeout.
2. **Notification fan-out** — Teams card + email on every state transition (Submitted, Approved, Rejected, More Info, Awaiting install, Installed, Install failed).
3. **Install dispatch + confirmation** — fires on status → Approved; notifies the install team with the request payload; waits for the install-confirmed (or install-failed) signal back; writes the `InstallEvent` row and updates the request status.
4. **More-Info auto-flip** — fires when a requester sends a reply to a request that is in *More Info* state; moves the request back to Pending so the approver re-sees it.

### 5.4 Data Layer — Dataverse

Tables (full ERD on page 3 of the diagram, deferred):

- **Request** — name, version, license type, **justification & evidence (rich text)**, **attachments (file column / child table)**, status, software lookup, requester (system `createdby`), approver lookup, dates.
- **Software** — catalog entries (name, vendor, license type, active flag).
- **Messages** — per-request thread between requester and approver (also used to surface install-team responses).
- **Approvals** — history table; one row per decision event (so reopen / re-decide is traceable).
- **WorkflowState** — current and historical state of each request (used for SLA / escalation queries).
- **AuditLog** — per-request timestamped log of every action across the platform (UI, workflow, install handoff). Dataverse system auditing is also enabled on the core tables.
- **InstallEvent** — install dispatched, confirmed, or failed; who confirmed; when; optional free-text reference to the install team's external tooling (e.g. an Intune deployment ID or a ticket number) for traceability.

### 5.5 Platform CI/CD — Azure DevOps

This pipeline builds and releases **the Code App itself**. It does not process requested software. Stages in order (detail on page 5, deferred):

1. **Checkout** — pull the Code App repo.
2. **Install + lint + unit test** — `npm ci`, ESLint, `tsc -b`, unit tests.
3. **SBOM generation** — Syft against `node_modules` to produce an SBOM for the Code App's npm dependencies.
4. **Vulnerability scan** — Grype against the SBOM. Gate on severity threshold (TBD with client).
5. **Build** — `vite build`.
6. **Publish to target environment** — `pac code push` against Dev, Test, or Prod depending on branch.

The platform CI/CD is separate from the request-workflow runtime. Failures here block a release of the platform itself; they have nothing to do with end-user software requests.

### 5.6 Install handoff — adjacent systems

The platform does not provision software onto endpoints. The install team performs provisioning through whichever channel the client already uses (Microsoft Intune is the typical case, but manual / scripted / SCCM are equally valid as far as this platform is concerned).

The handoff is a notification on Approved and a confirmation signal back:

- **Outbound (platform → install team)**: Teams card + email with the request payload and a confirmation link.
- **Inbound (install team → platform)**: confirmation via the link, or by an authorised user updating the request in the app. The signal writes an `InstallEvent` row and moves the request to *Installed* (or *Install failed*).

The platform tracks *that* the install happened; the *how* lives in the client's existing endpoint-management tooling. Optional: the `InstallEvent` row can capture a free-text reference to the install team's own system (e.g. an Intune deployment ID) so an analyst can pivot from a request to the underlying deployment record.

### 5.7 Notifications — Exchange + Teams

- Email notifications via the Office 365 Outlook connector in Power Automate.
- Teams notifications via Adaptive Cards posted to either an Approvers channel or via 1:1 chat (TBD with client).
- Notification events: submitted, approved, rejected, more-info requested, awaiting install, installed, install failed.

---

## 6. Cross-cutting concerns

### 6.1 Security

- **Authentication**: Entra SSO end-to-end. No local accounts or secondary identity stores.
- **Authorisation**: two layers — Entra group membership (UI role) + Dataverse custom security role (data-layer enforcement). Both must be set; either one alone is insufficient.
- **DLP**: the app uses the Dataverse connector, which must be on the client's Power Platform DLP allow-list. To be confirmed with the Power Platform admin team.
- **Secrets**: no secrets in source. Any credentials live as ADO service connections (platform CI/CD) or as Power Platform connection references (runtime flows).
- **Endpoint execution controls** (WDAC, AppLocker, etc.) are the client's existing controls and out of scope for this platform — see §8.1 for the disambiguation question this leaves open from the original requirement.

### 6.2 Auditability & traceability

- **Dataverse system auditing** enabled on Request, Approval, WorkflowState (full who-changed-what record-level log).
- **AuditLog table** for cross-system events emitted by Power Automate that don't map cleanly to row changes.
- **InstallEvent table** for the install handoff lifecycle (dispatched / confirmed / failed).
- A single request can be traced from submission → approval → install dispatch → install confirmation by joining Request, Approval, WorkflowState, and InstallEvent. Deeper deployment telemetry (per-device install success) lives in the client's endpoint-management tooling, not here.

### 6.3 Governance

- All Code App releases go through `pac code push` from a pipeline (not from a developer laptop).
- Solution export/import (or Power Platform pipelines) promotes Dataverse schema and Power Automate flows from Dev → Test → Prod.
- Power Platform CoE / admin team sign-off required before a new build reaches Production (TBD which group at the client — §8).

### 6.4 Environments & ALM

| Environment | Purpose | Notes |
|---|---|---|
| **Developer** (current) | Prototype only | Single-user; not viable for the live app. |
| **Sandbox / Dev** | Active development | Schema changes happen here first. |
| **Test** | UAT + integration testing | Mirrors Prod config; uses test data. |
| **Production** | Live | Restricted maker access; releases via pipeline. |

Promotion path: Sandbox → Test → Production. Region currently provisioned in Australia; must match client compliance requirements (§8).

### 6.5 Observability

- **App Insights** wired to the Code App for client-side telemetry and unhandled-error logging.
- **Power Platform admin centre** for flow run history and connector health.
- **ADO pipeline analytics** for the platform CI/CD pipeline (release success rate, stage duration).
- A Power BI dashboard over Dataverse (Request + Approval + InstallEvent + AuditLog) is the single source for request volume, approval throughput, SLA breach rate, and install-confirmation rate. v1 deliverable.

---

## 7. Lower-level designs to be produced (after high-level sign-off)

These are the tabs in `HighLevelDesign.drawio` that currently hold placeholders. Each will be drafted as a separate artefact once the high level is agreed. *(The diagram itself still reflects v0.1 of this document and will be rebuilt against the v0.2 scope — see §11.)*

1. **End-to-End Request Lifecycle** — sequence diagram across all components: happy path, More-Info loop, Rejection + Reopen, and the Install handoff (dispatch → confirmed / failed).
2. **Dataverse Data Model (ERD)** — full table list with columns, types, required flags, choice options, and relationships.
3. **Power Automate Workflows** — one BPMN-style diagram per flow listed in §5.3.
4. **Platform CI/CD pipeline (Azure DevOps)** — YAML stage breakdown for the Code App's own build and release pipeline.
5. **Install handoff sequence** — notification payload shape, confirmation-link mechanics, the InstallEvent state machine.
6. **Security & Identity Model** — layered identity (Entra user → group → Dataverse user → custom role), Graph permissions, DLP alignment.

---

## 8. Discussion points / open questions for the client

These need answers before the design can be finalised and the production build can start.

### 8.1 Original requirement disambiguation (highest priority)

The Phase 1 and Phase 2 deliverables in the original requirement list a full ADO pipeline (Syft / Grype / malware / sign), WDAC policies, Intune publishing, and test rings. This architecture reads those as **adjacent to the platform**, not as features built into it:

- The ADO pipeline in this design is for the **Code App's own CI/CD** (build, scan npm deps, `pac code push`).
- WDAC, Intune deployment, ring management, and end-user-software signing are the **client's existing endpoint controls**, used by the install team *after* a request is approved and dispatched.

Please confirm this matches the original intent. The alternative reading — the platform itself drives a full pipeline that scans, signs and pushes the requested software to Intune under WDAC enforcement — is much larger in scope and would significantly change the architecture and timeline.

### 8.2 Install handoff

- Who is the install team — a single group? Multiple, depending on software class?
- Confirmation mechanic — confirmation link in the notification, or an authorised user updating the request in the app? Both?
- Should the `InstallEvent` capture a reference back to the install team's tooling (e.g. Intune deployment ID, ticket number) as free text? Recommended yes for traceability.
- What happens to a failed install — back to the approver, back to the requester, or a dedicated install-team queue?
- SLA on the install handoff itself — how long after Approved before we consider it overdue?

### 8.3 Environment & licensing

- Sandbox + Production Dataverse environments — do they exist already, or do we need to request them from the global / tenant admin?
- Region: Australia in the current Developer env — does this match the client's data-residency requirements?
- Final user count (requesters + approvers) so we can recommend Power Apps Premium vs. Pay-as-you-go vs. per-app licensing.

### 8.4 Governance & sign-off

- Who needs to sign off before this goes to production? Power Platform admin? CoE team? IT security? Privacy / compliance? More than one?
- Are there existing DLP policies on the tenant we need to align with? The app uses the Dataverse connector — please confirm it is on the allow-list.
- Who owns the app long-term — who gets paged when it breaks?

### 8.5 Notifications

- Should the requester receive an email *and* a Teams notification, or just one of the two?
- Should approvers be notified via a shared Teams channel or individual DMs (or both)?
- SLA timer values: how long before a reminder? How long before auto-escalation? What is the escalation target?

### 8.6 Approval flow

- Is single-approver (any member of the approver group claims a request) sufficient for v1, or do we need multi-stage / dual-approval?
- Should auto-escalation route to a named user, a different security group, or block the request until manually unblocked?

### 8.7 Compliance & audit

- Any external auditors or frameworks (SOC 2, ISO 27001, GDPR, HIPAA) the platform needs to certify against? Power Platform inherits the relevant Microsoft certifications, but the app's data classification still needs sign-off.
- Should Dataverse auditing be enabled in full who-changed-what mode on all tables, or only the core ones (Request, Approval, WorkflowState)?
- Retention period for audit logs and message history?

### 8.8 Launch & onboarding

- Launch surface: SharePoint embed, Teams app/tab, or direct play URL from the intranet?
- How will new approvers / requesters be enrolled? If by Entra group, who manages group membership? (Typically the same team that already manages M365 group membership.)

---

## 9. References

- `Documentation/Client_Dev_CommunicationThread/260518_FirstDraftCommunication` — first-draft framework + licensing + roles communication with the client.
- `Documentation/Client_Dev_CommunicationThread/260526_OriginalRequirement.txt` — original four-phase requirement (Solution Design, Build, Acceptance Testing, Documentation & KT).
- `CONTEXT.md` — current prototype state and what is still missing for production.
- `CONNECT.md` — step-by-step instructions for wiring the project to a Power Platform environment.
- `HighLevelDesign.drawio` — companion diagram (this folder).
- Microsoft Learn — Power Apps Code Apps documentation.
- Microsoft Learn — Power Automate Dataverse triggers.
- Microsoft Learn — Power Platform ALM (solutions, pipelines).

---

## 10. Change log

| Version | Date | Author | Notes |
|---|---|---|---|
| 0.1 | 2026-05-20 | Solutions Architecture | Initial draft. High-level only. Lower-level designs deferred pending sign-off. |
| 0.2 | 2026-05-20 | Solutions Architecture | Rescoped: removed ADO build-of-requested-software, Intune publish and WDAC from the platform's responsibilities (moved to "adjacent / install team / open question §8.1"). Added install dispatch + confirmation flow and `InstallEvent` table. Consolidated request-form fields to a single "Justification & evidence" (rich text + attachments). Diagram redraw pending. |

---

## 11. Diagram alignment note

`HighLevelDesign.drawio` page 1 still shows the v0.1 architecture (auto-pipeline → Intune → WDAC as core platform components). It will be redrawn against this v0.2 scope once the §8.1 disambiguation is confirmed with the client — no point reworking the diagram twice. Placeholder tabs 2–7 already align with §7 of this document.
