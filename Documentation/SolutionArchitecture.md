# Software Request & Approval Platform — Solution Architecture

> **Document control**
> Version: 0.3 (draft, internal)
> Status: For client review — high-level only
> Author: Solutions Architecture
> Date: 2026-05-20
> Companion artefact: `HighLevelDesign.drawio` (same folder)

---

## 1. Purpose

This document captures the proposed solution architecture for the **Software Request & Approval Platform**: a tracked workflow for employees to request software that **requires a license**, have it reviewed and approved, and have its installation recorded against the request.

The platform exists to **keep licensed-software requests separate from the everyday flow** where the same employees self-install free / unlicensed software without justification. Licensed software needs auditable justification, an explicit approver decision, a record of what was approved for whom, and a record of when the installation actually happened. The free-install flow does not need any of that and is out of scope.

Provisioning the approved software onto the user's device remains an operational task carried out by IT through the client's existing channels (Intune, manual install, scripted deployment — whichever the client already uses). The platform's role in installation is to **dispatch and track** it: notify the right team when a request is raised, notify the user when the installation is approved with the provision of the license to the user. Automatic confirmation that the install happened is out of scope, but it can be manually tracked via status in the system with audit trail.

**Out of scope**: 

This document records:

- Architecture decisions already made (with rationale)
- Components and how they fit together
- Cross-cutting concerns (security, audit, ALM, observability)
- Open discussion points that still need a client decision
- A roadmap of the lower-level design artefacts we will produce after this high-level design is signed off

The Confluence import flow is: paste this file's contents into a new Confluence page using **Insert → Markdown**. The draw.io file can be attached to the page and opened with the *draw.io for Confluence* app, or exported to PNG for inline embedding.

## 2. Scope

### 2.1 In scope (this architecture)

- Requester UI: software request form with name, version, license type, justification & evidence (rich text + attachments), and metadata auto-fill
- Approver UI: queue, decision panel (Approve / Reject / Request more info), comments, **license grant details** (what is being granted to the user), audit log view, evidence view
- Dataverse data model covering Requests, Software catalog, Messages, Approval history (incl. license grant), Workflow States, Audit Logs
- Power Automate workflows: sequential approval, SLA timers, reminders, auto-escalation, rejection paths, notification fan-out (incl. license-grant notification to the user on Approval)
- Notifications via Exchange (email) and Microsoft Teams
- **Manual install-status tracking**: authorised users can advance a request from *Approved* → *Installed* (or *Install failed*) directly in the app; every transition is captured in the audit trail
- Platform CI/CD pipeline (Azure DevOps) for building and releasing **the Code App itself** — checkout, lint, test, npm-dependency SBOM/vuln scan, `pac code push` to the target environment
- Identity, role, governance and audit-trail design across all layers

### 2.2 Out of scope (for v1)

- Automated provisioning of the requested software (build, scan, sign, push to endpoints) — this is performed by IT through the client's existing channels; the platform only carries the user-facing notification and the manual status record
- **Automated confirmation that an install happened** — no endpoint agent, no callback from Intune, no programmatic completion signal. Install completion is a manual status update in the app.
- Automated license-key allocation / vendor-portal integration — the license team allocates licenses in their existing tooling; the platform records *what was granted* as free text on the approval
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
| AD-02 | **Dataverse** as the system of record for all request, workflow, audit and license-grant data | Same tenant, same auth as the UI; Microsoft-managed; native audit + change-tracking; OData query surface that the SDK already targets. No separate database to operate. |
| AD-03 | **Power Automate** as the workflow engine (approvals, timers, escalation, user notifications) | Native Dataverse triggers, native Teams/Outlook connectors. No custom orchestration code to maintain. |
| AD-04 | **License grant on Approval, manual install-status thereafter** — on Approve, the user is notified with the granted license details; install completion is recorded by a manual status update on the request, not by an automated callback | Keeps the platform decoupled from whatever endpoint-management or license-management tooling the client uses. Aligned with the original requirement scope as agreed with client: the platform tracks, it does not provision. |
| AD-05 | **One combined "Justification & evidence" field** on the request form (rich text + multi-attachment) instead of separate `justification` + `entitlement_evidence_url` fields | Matches how requesters actually write ("I need X because Y, see attached PO / screenshot / link"). Simpler UX; one field; takes whatever evidence the requester wants to drop in. Trade-off: no structured "evidence-present yes/no" metric (acceptable for v1). |
| AD-06 | **Platform CI/CD via Azure DevOps**, scoped to the Code App itself (lint, test, npm SBOM/vuln scan, `pac code push`) | YAML-defined pipeline the client can version-control and audit. ADO already in use at the client. Distinct from any pipeline that processes requested software (which is out of scope — see §8.1). |
| AD-07 | **Entra security group** as the source of truth for role membership (approver vs. requester) | One source IT already manages. The app checks group membership via Microsoft Graph at sign-in. Anyone not in the group is a requester by default. Chosen over a Dataverse-table or security-role-read approach (see §8). |
| AD-08 | **Dataverse custom security roles** (`SoftwareRequest-Requester`, `SoftwareRequest-Approver`) for table-level authorisation | Defence in depth: the UI gates by Entra group, but the data layer also enforces who can read/write what. Group membership alone is not enough. |
| AD-09 | **Sequential approval** with timers, reminders and auto-escalation in v1 (single approver group — the license team) | Matches the stated requirement. Multi-stage / multi-approver routing is a v2 candidate. |
| AD-10 | **Three-decision model** on the approver form: Approve / Reject / Request more info | More-info routes the request back to the requester through the message thread; the request stays open. Reject is terminal but can be reopened by the requester. |
| AD-11 | **Per-request message thread** stored in Dataverse | Captures requester ↔ approver dialogue alongside the audit trail. Used for the More-info loop. |
| AD-12 | **Three Dataverse environments** for ALM: Dev → Test → Production (minimum Sandbox + Production) | The Developer environment used for the prototype is single-user by design and cannot host the live app. |
| AD-13 | **TypeScript strict mode**, no `any`, no hand-written Dataverse fetches | All Dataverse calls go through the SDK-generated services in `src/generated/`. The generated folder is never hand-edited. |

---

## 4. Solution overview

See `HighLevelDesign.drawio`, page 1. *(Diagram still reflects v0.1 — to be redrawn against this rescope; see §11.)*

A signed-in employee opens the Power Apps Code App. The app authenticates them via Entra SSO, then checks Entra group membership through Microsoft Graph: members of `SoftwareRequest-Approvers` see the approver experience; everyone else sees the requester experience.

A requester submits a software request — name, version, license type, and a combined Justification & evidence field (rich text + attachments such as a PO screenshot, an eProcurement link, a vendor quote). The submission writes a row to the Dataverse **Request** table. A Power Automate flow fires on the row insert: it records the initial workflow state, sends the approver group (the license / security review team) a Teams card and email, and starts the SLA timer.

The approver opens the same app, picks the request from their pending queue, and either Approves, Rejects, or asks for More Info. On Approve, the approver records the **license-grant details** alongside the decision (e.g. "Photoshop subscription seat allocated, see vendor portal X" or "Internal license key attached"). The decision and the grant details are written back to Dataverse; the audit trail records who decided what, when. *Request more info* puts the request in a non-terminal state where the requester and approver exchange messages until the approver re-decides. Rejection can be reversed by the requester (move back to Pending).

On **Approve**, Power Automate notifies the **user** (the requester) with the approval outcome and the license-grant details. The user now has what they need to install the software themselves through whichever channel applies (vendor download with their new license, a corporate software portal, an IT-mediated install — that detail is outside the platform's awareness).

When the user has actually installed the software, an authorised user (the requester themselves, the approver, or whomever the client designates — see §8.2) marks the request as **Installed** in the app. The status update is captured in the audit trail. The request is now closed. *Install failed* is the symmetric path for when the user reports the install did not work — back to the message thread for diagnosis.

There is no automated install confirmation, no callback from Intune, no endpoint agent. The full *request → approval → install* timeline is reconstructable from Dataverse (Request status history + Approval row + AuditLog).

---

## 5. Components

### 5.1 Identity & Access (Entra ID)

- **Entra ID** is the tenant identity provider. All authentication is Entra SSO.
- **`SoftwareRequest-Approvers` security group** — single source of truth for who is an approver (the license / security review team). Membership is managed in the existing IT process for security-group changes.
- **Microsoft Graph** — the Code App calls `/me/memberOf` (or `/me/checkMemberGroups`) at sign-in to determine the user's role. A token-acquisition seam (MSAL.js inside the Code App, or a thin Power Automate / custom connector wrapper) is required because the Power Apps SDK does not expose a Graph token directly.

### 5.2 Presentation Layer — Power Apps Code App

- React 19 + TypeScript + Vite, deployed through `pac code push`.
- Served by the Microsoft-managed Power Platform runtime — no separate hosting to operate.
- Components: Requester form, My-Requests list & detail (incl. *Mark as installed* / *Mark as install failed* actions), Approver queue (Pending + All), Approver detail with Decision panel + license-grant field, message thread, audit view.
- All data access goes through SDK-generated services (`src/generated/services/`), which target Dataverse OData. No raw fetch calls.
- Strict TypeScript, no `any`. SDK init is gated on `isInitialized` before any UI renders.

### 5.3 Workflow Layer — Power Automate

Four flows (detail on page 4 of the diagram, deferred):

1. **Approval orchestration** — fires on Request row insert; sets initial workflow state; sends the approver group notifications; starts SLA timer; sends reminders; auto-escalates on timeout.
2. **Notification fan-out** — Teams card + email on every state transition (Submitted, Approved with license-grant details to the user, Rejected, More Info, Installed, Install failed).
3. **Approval → user notification** — fires on status → Approved; sends the user a Teams card + email carrying the approver's decision and the license-grant details (what was granted, where to get it, any keys / portal links the approver recorded).
4. **More-Info auto-flip** — fires when a requester sends a reply to a request that is in *More Info* state; moves the request back to Pending so the approver re-sees it.

### 5.4 Data Layer — Dataverse

Tables (full ERD on page 3 of the diagram, deferred):

- **Request** — name, version, license type, **justification & evidence (rich text)**, **attachments (file column / child table)**, status (Pending / Approved / Installed / Install failed / Rejected / More info), software lookup, requester (system `createdby`), approver lookup, dates (created, approved, installed-marked).
- **Software** — catalog entries (name, vendor, license type, active flag).
- **Messages** — per-request thread between requester and approver.
- **Approvals** — history table; one row per decision event (so reopen / re-decide is traceable). Includes a **license-grant** rich-text field recording what was granted to the user.
- **WorkflowState** — current and historical state of each request (used for SLA / escalation queries and the audit timeline).
- **AuditLog** — per-request timestamped log of every action across the platform (submission, approval, manual status updates, replies). Dataverse system auditing is also enabled on the core tables, providing a who-changed-what record-level log as a back-stop.

> Status transitions like *Installed* and *Install failed* are plain updates to the Request status field. There is no separate `InstallEvent` table — the manual nature of the update and the system audit log together cover the lifecycle without one.

### 5.5 Platform CI/CD — Azure DevOps

This pipeline builds and releases **the Code App itself**. It does not process requested software. Stages in order (detail on page 5, deferred):

1. **Checkout** — pull the Code App repo.
2. **Install + lint + unit test** — `npm ci`, ESLint, `tsc -b`, unit tests.
3. **SBOM generation** — Syft against `node_modules` to produce an SBOM for the Code App's npm dependencies.
4. **Vulnerability scan** — Grype against the SBOM. Gate on severity threshold (TBD with client).
5. **Build** — `vite build`.
6. **Publish to target environment** — `pac code push` against Dev, Test, or Prod depending on branch.

The platform CI/CD is separate from the request-workflow runtime. Failures here block a release of the platform itself; they have nothing to do with end-user software requests.

### 5.6 Post-approval flow — license grant + self-install

The platform's role after Approval is to **communicate and record**, not to provision:

- **Communicate**: notify the user with the approval and the license-grant details the approver entered. Channel: email + Teams card via Power Automate.
- **Record**: keep the approval (with grant details), the resulting user-side install status, and the audit trail in Dataverse.

Actual install execution is performed by the user (or by IT acting on the user's behalf) through whichever channel the granted license implies — vendor download, internal software portal, IT-mediated install. The platform is intentionally agnostic about that.

Status progression after Approval:

- **Approved** — license granted, user has been notified, install pending the user's action.
- **Installed** — user (or another authorised role) has manually marked the request as installed in the app.
- **Install failed** — user reports the install did not work; reopens the message thread for diagnosis.

Who is authorised to advance the status from *Approved* to *Installed* (the requester themselves? IT? the approver?) is an open question — see §8.2.

### 5.7 Notifications — Exchange + Teams

- Email notifications via the Office 365 Outlook connector in Power Automate.
- Teams notifications via Adaptive Cards posted to either an Approvers channel or via 1:1 chat (TBD with client).
- Notification events: submitted (→ approvers), approved with license-grant details (→ requester), rejected (→ requester), more-info requested (→ requester), installed (→ approvers, for visibility), install failed (→ approvers + back to the message thread).

---

## 6. Cross-cutting concerns

### 6.1 Security

- **Authentication**: Entra SSO end-to-end. No local accounts or secondary identity stores.
- **Authorisation**: two layers — Entra group membership (UI role) + Dataverse custom security role (data-layer enforcement). Both must be set; either one alone is insufficient.
- **DLP**: the app uses the Dataverse connector, which must be on the client's Power Platform DLP allow-list. To be confirmed with the Power Platform admin team.
- **Secrets**: no secrets in source. Any credentials live as ADO service connections (platform CI/CD) or as Power Platform connection references (runtime flows). The license-grant field is free text — sensitive license keys captured here are protected by Dataverse row-level security and the custom security roles in AD-08, not by encryption.
- **Endpoint execution controls** (WDAC, AppLocker, etc.) are the client's existing controls and out of scope for this platform — see §8.1 for the disambiguation question this leaves open from the original requirement.

### 6.2 Auditability & traceability

- **Dataverse system auditing** enabled on Request, Approval, WorkflowState (full who-changed-what record-level log).
- **AuditLog table** for cross-system events emitted by Power Automate (notifications sent, SLA timers fired) that don't map cleanly to row changes.
- A single request can be traced from submission → approval (with license grant) → manual install confirmation by joining Request, Approval, and WorkflowState. Every status transition — including manual *Installed* / *Install failed* updates — is preserved in the system audit log.

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
- A Power BI dashboard over Dataverse (Request + Approval + WorkflowState + AuditLog) is the single source for request volume, approval throughput, SLA breach rate, and the rate at which approved requests get manually marked as Installed (lag from Approved → Installed). v1 deliverable.

---

## 7. Lower-level designs to be produced (after high-level sign-off)

These are the tabs in `HighLevelDesign.drawio` that currently hold placeholders. Each will be drafted as a separate artefact once the high level is agreed. *(The diagram itself still reflects v0.1 of this document and will be rebuilt against the v0.3 scope — see §11.)*

1. **End-to-End Request Lifecycle** — sequence diagram across all components: happy path (Submit → Approve with grant → user notified → manual Installed), More-Info loop, Rejection + Reopen, and the Install-failed path.
2. **Dataverse Data Model (ERD)** — full table list with columns, types, required flags, choice options, and relationships.
3. **Power Automate Workflows** — one BPMN-style diagram per flow listed in §5.3.
4. **Platform CI/CD pipeline (Azure DevOps)** — YAML stage breakdown for the Code App's own build and release pipeline.
5. **Post-approval flow** — license-grant notification payload shape, the manual status-update UI, the *Approved → Installed / Install failed* state machine.
6. **Security & Identity Model** — layered identity (Entra user → group → Dataverse user → custom role), Graph permissions, DLP alignment.

---

## 8. Discussion points / open questions for the client

These need answers before the design can be finalised and the production build can start.

### 8.1 Original requirement disambiguation (highest priority)

The Phase 1 and Phase 2 deliverables in the original requirement list a full ADO pipeline (Syft / Grype / malware / sign), WDAC policies, Intune publishing, and test rings. This architecture reads those as **adjacent to the platform**, not as features built into it:

- The ADO pipeline in this design is for the **Code App's own CI/CD** (build, scan npm deps, `pac code push`).
- WDAC, Intune deployment, ring management, and end-user-software signing are the **client's existing endpoint controls**, used after a request is approved and the user proceeds to install.

Please confirm this matches the original intent. The alternative reading — the platform itself drives a full pipeline that scans, signs and pushes the requested software to Intune under WDAC enforcement — is much larger in scope and would significantly change the architecture and timeline.

### 8.2 Post-approval flow

- Where does the **license-grant detail** come from? The approver types it free-form on the approval (current assumption), or does the license team pre-allocate a license elsewhere and the approver attaches a reference?
- Who is authorised to advance status from *Approved* → *Installed*? Options: the requester only (they know when they installed), any approver, a dedicated IT role, multiple. Recommended: requester + approvers, with the audit log distinguishing.
- Should *Installed* time out — i.e. if not marked within N days of Approval, escalate or auto-mark? Recommended: no auto-mark, but raise a reminder to the requester after N days.
- Does the platform need a periodic re-check of *Installed* requests (license still valid, software still in use)? Out of scope for v1 — flag for v2.
- *Install failed*: routes back to the message thread by default. Should it also re-notify the approver, or only re-notify when the requester explicitly asks for help?

### 8.3 Environment & licensing (Power Platform)

- Sandbox + Production Dataverse environments — do they exist already, or do we need to request them from the global / tenant admin?
- Region: Australia in the current Developer env — does this match the client's data-residency requirements?
- Final user count (requesters + approvers) so we can recommend Power Apps Premium vs. Pay-as-you-go vs. per-app licensing.

### 8.4 Governance & sign-off

- Who needs to sign off before this goes to production? Power Platform admin? CoE team? IT security? Privacy / compliance? More than one?
- Are there existing DLP policies on the tenant we need to align with? The app uses the Dataverse connector — please confirm it is on the allow-list.
- Who owns the app long-term — who gets paged when it breaks?

### 8.5 Notifications

- Should the requester receive an email *and* a Teams notification on approval, or just one?
- Should approvers be notified via a shared Teams channel or individual DMs (or both)?
- SLA timer values: how long before a reminder? How long before auto-escalation? What is the escalation target?
- License-grant detail in notifications: deliver inline in the Teams card / email body, or as a link back into the app? (Inline is friendlier; link is safer if the grant detail contains a license key.)

### 8.6 Approval flow

- Is single-approver (any member of the approver group claims a request) sufficient for v1, or do we need multi-stage / dual-approval (e.g. license + security separately)?
- Should auto-escalation route to a named user, a different security group, or block the request until manually unblocked?

### 8.7 Compliance & audit

- Any external auditors or frameworks (SOC 2, ISO 27001, GDPR, HIPAA) the platform needs to certify against? Power Platform inherits the relevant Microsoft certifications, but the app's data classification still needs sign-off.
- Should Dataverse auditing be enabled in full who-changed-what mode on all tables, or only the core ones (Request, Approval, WorkflowState)?
- Retention period for audit logs and message history?
- Sensitivity of license-grant detail: if vendor license keys end up in this field, is row-level Dataverse security sufficient, or should the field be encrypted-at-rest beyond Dataverse's default?

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
| 0.2 | 2026-05-20 | Solutions Architecture | Rescoped: removed ADO build-of-requested-software, Intune publish and WDAC from the platform's responsibilities (moved to "adjacent / install team / open question §8.1"). Added install dispatch + confirmation flow and `InstallEvent` table. Consolidated request-form fields to a single "Justification & evidence" (rich text + attachments). |
| 0.3 | 2026-05-20 | Solutions Architecture | Replaced the install-team dispatch + automated-confirmation model with: notify the user on Approval with license-grant details; status thereafter is manually advanced (Installed / Install failed) in the app. Dropped the `InstallEvent` table — Request status + Dataverse system audit cover the lifecycle. Added a license-grant field to the Approvals table and the approver UI. Updated §8.2 to the post-approval flow questions this opens. Diagram redraw pending. |

---

## 11. Diagram alignment note

`HighLevelDesign.drawio` page 1 still shows the v0.1 architecture (auto-pipeline → Intune → WDAC as core platform components). It will be redrawn against this v0.3 scope once the §8.1 disambiguation is confirmed with the client — no point reworking the diagram twice. Placeholder tabs 2–7 already align with §7 of this document.
