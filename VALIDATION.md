# Validation record

Date: 2026-09-20. Scope: local bootstrap only, not customer certification.

## Executed successfully

- TypeScript 5.8.3 strict `tsc --noEmit` on Linux.
- Node.js 22.16.0 built-in test runner: 60 tests, no skips.
- Actual SQLite 3.49.1 in-memory D1-shaped adapter, not SQL string mocks.
- Generated RSA JWT signature/claims validation using WebCrypto, not live Access.
- Cross-tenant denial before data access, swapped binding guard, roles/revocation.
- Semantic query validation, dimensions, dates, no raw SQL, null/capacity/cash rules.
- Snapshot idempotency, conflicts, failed archive/database writes, atomic publication,
  backwards-watermark protection, natural-grain uniqueness and concurrent retries.
- Dashboard creation, role checks and optimistic edits with strong ETags.
- Deployment config validation and execution of generated bootstrap SQL in SQLite.
- GitHub publisher dry run; **no Git initialization or push was performed**.
- Invalid placeholder Cloudflare inventory was refused as intended.
- Repository dependency/config/document-link checks.

## UI validation

Ten offline browser checks passed using Chromium with authored HTML/CSS/JavaScript.
Fetch was connected through a stdio bridge to the actual API services and SQLite
fixtures. Checks cover KPI values, six widgets, tenant switching, viewer controls,
create/edit, desktop/mobile overflow, missing-data display and uncaught JS errors.

Desktop viewport: 1440 x 1050. Mobile viewport: 390 x 844. Both screenshots were
visually inspected. No horizontal page overflow or uncaught JavaScript error was
observed. Horizontally scrollable tabular content is deliberate on mobile.

Reproduction, with a separately installed Python Playwright and Chromium:

```bash
python tools/ui-smoke.py --chromium /path/to/chromium --out validation-artifacts
```

Direct Chromium HTTP navigation to the local server was blocked by the environment
(`ERR_BLOCKED_BY_ADMINISTRATOR`). The offline bridge is an explicit test substitute,
not proof of network routing, CSP enforcement, Access or workerd compatibility.

## Not executed / not certified

- GitHub write, PR, merge or remote CI. Current connector exposes read-only operations.
- Cloudflare resource creation, account changes, production deployment or billing.
- Wrangler/workerd integration, actual D1/R2 transactions, migration ledger or quotas.
- Real Access identity/key rotation and edge origin/routing configuration.
- npm clean installation or live advisory audit: network access was unavailable to
  the code container. TypeScript package metadata/integrity was checked via the
  public registry; local typecheck used the preinstalled same compiler version.
- macOS/Windows test jobs: workflow is prepared, not remotely executed.
- Production load, per-tenant rate admission, restore, SLA or data residency.
- Real customer connector, customer data, finance correctness across ERPs or AI inference.

## Known bootstrap boundaries

Seven reviewed operations metrics, VND only, 1-20 aggregated rows per source snapshot,
1-20 registered sources per deployment inventory tenant, query window up to 93 days,
200 result rows, 12 widgets/dashboard and 50 dashboards/tenant. No empty-snapshot
publication, full visual canvas, arbitrary model editor or permission-filtered export.

Every remaining gate is explicit in SECURITY.md and TASKS.md. Do not label this a
released or deployed BI platform until those environment-specific checks pass.
