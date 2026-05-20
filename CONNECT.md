# Connecting a Power Apps Code App to Dataverse

Step-by-step for wiring (or re-wiring) this project to a Power Platform environment + Dataverse tables.

## Prerequisites

Install once on the dev machine:

- **Node.js 20+** and npm
- **Power Platform CLI (`pac`)** — install via:
  ```powershell
  winget install Microsoft.PowerPlatformCLI
  ```
  Or download from https://aka.ms/PowerPlatformCLI. Confirm with `pac --version`.

## 1. Sign in to Power Platform

```powershell
pac auth create --environment <ENVIRONMENT_URL_OR_ID>
```

- `<ENVIRONMENT_URL_OR_ID>` is either the env's URL (`https://orgXXXX.crm6.dynamics.com`) or its GUID (from Power Platform admin center → Environments).
- A browser pops up for Entra sign-in.
- Verify with `pac auth list` — the current profile should show `*`.
- Switch profiles later with `pac auth select --index <n>`.

## 2. Initialize a Code App (skip if `power.config.json` already exists)

From an empty folder:

```powershell
npm create vite@latest . -- --template react-ts
npm install
pac code init --displayName "Software Request"
```

`pac code init` creates:
- `power.config.json` — env binding and app metadata
- `.power/` — generated schemas and data-source info
- Adds `@microsoft/power-apps` and `@microsoft/power-apps-vite` to `package.json`
- Patches `vite.config.ts` with the `powerApps()` plugin

## 3. Connect Dataverse tables (the "connect" step)

For each table the app should read/write:

```powershell
pac code add-data-source --tableName cr108_request
pac code add-data-source --tableName cr108_software
pac code add-data-source --tableName cr108_messages
```

What this does:
- Resolves the table's schema from the connected env
- Writes JSON schema files into `.power/schemas/dataverse/`
- **Generates typed TypeScript files** into `src/generated/`:
  - `src/generated/models/Cr108_<table>Model.ts` — interfaces + choice enums
  - `src/generated/services/Cr108_<table>Service.ts` — CRUD methods
  - `src/generated/index.ts` — re-exports
- Updates `power.config.json` → `databaseReferences.default.cds.dataSources`

> Use the **logical name** (singular, like `cr108_request`), not the entity set name (`cr108_requests`).

> **Never edit `src/generated/`** — it's overwritten on every regenerate.

## 4. Install JS deps and run locally

```powershell
npm install
npm run dev
```

Open the printed `http://localhost:3000` URL in a browser already signed in as a user who has:
- A Power Apps paid entitlement (Premium, PAYG, or per-app) — except in a Developer env, where the free Developer Plan license is enough
- Access to the environment (env user record + Dataverse security role with at least Read on the tables)

The SDK calls `app.getContext()` on load to resolve the signed-in identity. If you see `Failed to load Dataverse database references from runtime`, the user lacks env access or the right security role — fix it in Power Platform admin center, not in code.

## 5. After any schema change in Dataverse → regenerate

Whenever you add/remove columns, change choice options, or flip a required flag in make.powerapps.com:

```powershell
pac code add-data-source --tableName <table_logical_name>
```

Re-running the same command refreshes the schema and rewrites `src/generated/`. Re-run for each affected table. TypeScript will surface mismatches between old code and the new model on the next `npx tsc -b`.

## 6. Push to the connected environment

```powershell
pac code push
```

This builds the app (`tsc -b && vite build`), uploads the bundle to the environment, and registers it as a runnable Code App. After push:
- The app appears in make.powerapps.com → Apps under the connected env
- Share it from the Apps list (Power Apps sharing is separate from Dataverse security roles — set both)
- Users open it via the play URL or embed it in SharePoint/Teams

## 7. Switching environments

To point the project at a different env:

```powershell
pac auth create --environment <NEW_ENV_URL_OR_ID>
pac code init --displayName "Software Request"  # rebinds power.config.json
# Re-add data sources against the new env:
pac code add-data-source --tableName cr108_request
pac code add-data-source --tableName cr108_software
pac code add-data-source --tableName cr108_messages
```

The tables must already exist in the target env (export/import the solution from the old env first, or recreate them).

## Reference

- Project root: `D:\ai projects\software_install_request`
- Environment ID: `28aae012-bbfb-ee49-a6d9-8557e28acfc6` (Developer env — replace before going to production)
- Region: `prod` / Australia
- Tables: `cr108_request`, `cr108_software`, `cr108_messages`
