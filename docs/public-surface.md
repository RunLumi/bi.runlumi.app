# Public extension surface (v1)

The stable contract customer applications and reviewed extensions build on.
Imports outside this list are private core internals and may change in any
release; importing them is rejected by `npm run check` (see `scripts/check-repo.mjs`).

## @runlumi/core

| Module | Stable since | Purpose |
| --- | --- | --- |
| `api.ts` | 0.1.0 | `createApi`, extension/connector/metric types |
| `contracts.ts` | 0.1.0 | error types, shared value validators |
| `installation-auth.ts` | 0.1.0 | session/user authority primitives |
| `ports.ts` | 0.1.0 | `Database`/`ObjectStore`/`AppEnv` binding types |
| `semantics.ts`, `query.ts`, `ingest.ts` | 0.1.0 | operations metric semantics and import |
| `commerce-model.ts` | 0.1.0 | canonical commerce contract, schema fingerprint |
| `commerce-jobs.ts` | 0.1.0 | durable normalization jobs |
| `customer-config.ts`, `version.ts` | 0.1.0 | manifest compatibility, release version |

Experimental (may change; documented in the delivery checklist):
`commerce-query.ts`, `commerce-report.ts`, `commerce-receipts.ts`,
`commerce-normalization.ts`, `commerce-publication.ts`, `commerce-decisions.ts`,
`commerce-insights.ts`, `commerce-insight-artifacts.ts`, `commerce-evidence.ts`,
`commerce-capabilities.ts`, `commerce-analyst.ts`, `commerce-readiness.ts`,
`commerce-envelope.ts`, `password.ts`, `licensing.ts`, `extension-contracts.ts`,
`http.ts`, `licensing policy` types.

Everything else under `packages/*/src` is private.

## @runlumi/cloudflare

`auth.ts` (optional Access verification), `request-auth.ts` (session→Access
composition), `testing.ts` (local SQLite adapter for customer tests).

## @runlumi/ui

`app.tsx` (`createApp`, `AppPage`/`PageContext`/`NavContext`),
`lib/api.ts` (typed client + error messages),
`components/ui/*`, `components/states.tsx`, `components/glyphs.tsx`,
`features/{dashboard,sources,commerce,commerce-report,decisions,reports,admin,auth}.tsx`.

## Migration ledger

`core/*` migrations are immutable after apply; `customer/*` migrations are
owned by the application. See `user-guide/11-update-core-and-migrations.md`.
