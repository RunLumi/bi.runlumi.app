# 3. Configure database, storage, hostname and secrets

Each installation binds to fixed resources with ordinary paths. Nothing ever
selects a database or bucket at request time.

## Create the Cloudflare resources (manual, one-time per environment)

```bash
# working directory: the generated customer repository
npx wrangler d1 create acme-production-db
npx wrangler r2 bucket create acme-production-sources
```

Repeat per environment (for example `acme-staging-db`). The generated
`infra/environments/<env>.json` already contains scaffold identifiers; replace
the scaffold D1 `databaseId` with the real id `wrangler d1 create` printed.

## Review the deployment inventory

For each `infra/environments/<env>.json`:

- `hostname` — replace the scaffold `acme-production.bi.runlumi.app` with your
  real hostname, then set `"hostnameReviewed": true`. `deploy:plan` refuses to
  produce a plan until you do.
- `accessTeam` — replace `replace-access-team` if you plan to put Cloudflare
  Access in front of the hostname. Access is optional; the application itself
  authenticates users directly.
- `database` and `sourcesBucket` — must match the resources you created.
  Every environment must use distinct resources; `validate` enforces it.

## Effective Wrangler configuration

`apps/worker/wrangler.jsonc` is generated from the inventories: production is
the base configuration and every other environment is a named `env.<name>`
section. It declares exactly two data bindings: `DB` (D1) and `SOURCES` (R2),
plus `ASSETS` for the built SPA.

## Secrets and variables

| Name | Kind | Required | Purpose |
| --- | --- | --- | --- |
| `ACCESS_TEAM`, `ACCESS_AUD` | vars | no | Enable optional Cloudflare Access verification. Unset or placeholder values keep Access disabled. |
| `SETUP_TOKEN` | secret | **required for production** | One-time operator secret for first-run setup. A production environment (`ENVIRONMENT=production`) refuses initialization without it (`SETUP_PROTECTION_REQUIRED`), closing the takeover race between deploy and setup. |

```bash
# working directory: the generated customer repository
npx wrangler secret put SETUP_TOKEN --config apps/worker/wrangler.jsonc
```

## Apply the schema (explicit, never automatic)

The installation never rewrites or deletes an existing database. Apply
migrations explicitly with the ledger-aware runner:

```bash
# working directory: the generated customer repository (local D1)
npm run migrate

# real database of an environment (requires wrangler auth)
npm run migrate -- --remote
npm run migrate -- --remote --env staging
```

The runner applies core installation migrations (from the vendored core
package, e.g. `0001_initial.sql`, `0002_credentials_and_commerce.sql`,
`0003_account_hardening.sql`) and your own `customer/migrations/*.sql`, in
order, recording each in the `schema_migrations` ledger. Applied migrations are
immutable history: a changed or removed file is rejected, never re-run.
Upgrading an installation that predates the ledger is one-time:
`npm run migrate -- --remote --adopt` records what is already applied without
executing anything.

Migrations are additive and never destructive. Back up first (chapter 12).

Continue to [Initialize and create the administrator](04-initialize-and-administrator.md).
