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
| `SETUP_TOKEN` | secret | recommended | When set, first-run setup requires this token, protecting against setup takeover between deploy and initialization. |

```bash
# working directory: the generated customer repository
npx wrangler secret put SETUP_TOKEN --config apps/worker/wrangler.jsonc
```

## Apply the schema (explicit, never automatic)

The installation never rewrites or deletes an existing database. Apply
migrations explicitly, in order, per environment:

```bash
# working directory: the generated customer repository
npx wrangler d1 execute DB --remote \
  --config apps/worker/wrangler.jsonc \
  --file node_modules/@runlumi/core/migrations/installation/0001_initial.sql
npx wrangler d1 execute DB --remote \
  --config apps/worker/wrangler.jsonc \
  --file node_modules/@runlumi/core/migrations/installation/0002_credentials_and_commerce.sql
```

Core migrations ship inside the checksummed core package. Your own migrations
live in `customer/migrations/` and are applied the same way (or with
`wrangler d1 migrations apply DB --remote`, which uses `customer/migrations`).

Migrations are additive and never destructive. The application never deletes or
rewrites an existing customer database automatically; a fresh install on an
existing database with a populated schema fails fast instead of overwriting
data. Back up first (chapter 12).

Continue to [Initialize and create the administrator](04-initialize-and-administrator.md).
