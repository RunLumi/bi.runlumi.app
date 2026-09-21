# 1. Requirements and supported capabilities

## What one installation is

Lumi BI is deployed **per customer**. One installation owns:

- one Worker and one hostname;
- one D1 database (binding `DB`);
- one private R2 bucket (binding `SOURCES`);
- its own users, sessions, roles, credentials, configuration and audit history.

Requests, jobs, source data and model arguments can never select another
installation's database. There is no tenant, workspace, fleet or registration
layer to configure or attack.

## Requirements

| Requirement | Details |
| --- | --- |
| Node.js | >= 22.16 (uses built-in `node:sqlite` and type stripping) |
| Cloudflare account | One per customer is recommended; the Worker, D1 and R2 all live there |
| wrangler | Pinned in the repository's devDependencies |
| Browser | Any current Chromium/Firefox/Safari; the UI is a React SPA |

Cloudflare Access or any external SSO is **optional**. The default journey
uses direct email + password sign-in handled by the installation itself.

## Supported capabilities

**Automated and verified:**

- First-run setup, direct sign-in/sign-out, bounded sessions (14 days),
  disabled-user revocation, last-administrator protection.
- Operational BI: register sources, import bounded snapshots (1–20 rows each,
  idempotent, checksummed in R2), typed semantic queries with snapshot context,
  editable dashboards with revision-checked saves.
- Commerce evidence pipeline: register authorized-export connections, accept
  immutable raw receipts, normalize or quarantine them, run durable
  normalization jobs with leases and bounded retries, review and publish
  reports atomically, query published data, export CSV/JSON, keep findings and
  a decision register with outcome evidence, save reports with reproducible
  runs.
- Exact integer arithmetic (BigInt/VND minor units), NULL-not-zero semantics,
  source-completeness warnings that are never silently cleared.
- Customer customization: custom React pages, TSX report proposals, server
  metrics, connectors, decision rules, migrations and tests in **your**
  repository.
- Update tooling: checksum-verified core upgrades that preserve custom files,
  refuse dirty trees, and produce reviewable diffs.

**Manual procedures (documented, not automated):**

- Creating the Cloudflare D1 database and R2 bucket.
- Applying migrations to the serving D1 (`wrangler d1 execute` / `migrations apply`).
- Backups (`wrangler d1 export`) and restores.
- DNS and, if desired, Cloudflare Access configuration.

**Not implemented — do not claim:**

- Live provider connectors or vendor certifications (only authorized exports).
- Bank reconciliation or statutory accounting; the published report is a
  recognized-order cohort view with explicit warnings.
- Autonomous actions from findings; the decision register is advisory only.
- Automated cross-installation anything. Each installation is isolated.

Continue to [Create your repository](02-create-your-repository.md).
