# Operating this customer application

## Environments and identity

Each environment (`infra/environments/<env>.json`) owns distinct resources: Worker,
hostname, Access team/audience, serving D1 and private R2 bucket. `lumi.lock.json`
is **customer-level** — deployment identity never lives in the lock. The effective
Wrangler configuration (`apps/worker/wrangler.jsonc`) uses `production` as the base
and a named `env.<environment>` section per additional environment.

Deployment identity is **server-owned**: `CUSTOMER_ID`, `DEPLOYMENT_ID` and the
Access audience come from the reviewed deployment configuration, never from a
request. The Worker binds only to this environment's fixed `DB` (D1) and
`SOURCES` (R2); no request, job or payload can select another installation's
resources, and a foreign database simply does not carry this installation's
data.

## Deploy

1. `npm ci --ignore-scripts`
2. `npm run validate` — scaffold correctness for **every** environment (identity,
   reserved routes, wrangler/inventory agreement, resource distinctness).
3. `npm run build`
4. `npm run deploy:plan <env>` — the deployable-release review gate. It blocks while
   the hostname is unreviewed (`hostnameReviewed: false`), the Access team is a
   scaffold value, audiences are placeholder or reused, or D1 identity is a zero/missing
   UUID. A plan creates no Cloudflare resource.
5. (Optional) Put Cloudflare Access in front of the hostname with the reviewed
   team and audience. Access authenticates in addition to the local user model;
   it is never required for the default journey.
6. Apply core migrations from `node_modules/@runlumi/core/migrations/installation`,
   then customer migrations from `customer/migrations`, to the serving D1.
7. Deploy the Worker:
   - production (base): `npx wrangler deploy --config apps/worker/wrangler.jsonc`
   - other environments: `npx wrangler deploy --config apps/worker/wrangler.jsonc --env <env>`
8. Initialize once (administrator email + password; requires the `SETUP_TOKEN`
   secret when one is configured — setup closes permanently afterwards), then
   verify `/healthz`, direct sign-in, and a query.

## Security posture

- Workers.dev and preview URLs are disabled in every environment's configuration.
- Browser requests are same-origin; mutations use the core origin/CSRF check.
- Users authenticate directly against this installation (salted PBKDF2 password
  credentials, HttpOnly bounded sessions) or, when configured, through the
  packaged Access verifier matched to a local user. Local demo headers are never
  read in a deployed Worker.
- The Worker has a binding only to this customer's serving database and sources
  bucket; it has no binding to another customer's business data. It also refuses to
  proxy fleet-administration endpoints: separate the operator surface from customer
  traffic.
- Dedicated Workers in a shared Cloudflare account are **not** complete account/IAM
  isolation. Scope deployment tokens to this Worker's resources. A customer-managed
  account would additionally require authenticated transport; that is not
  implemented and must not be claimed.

## Rollback

Reverting the Worker version restores code, not data. A database migration is not
reversed, money is not refunded and external actions are not undone. Preview a
rollback against the migrated database before deploying it.

## Incident

Without a verified session (or a verified Access identity matched to an active
local user) the application fails closed and serves no customer data. Disabled
users lose all sessions immediately; the last active owner cannot be disabled
through the application. Investigate the local `users`, `sessions` and
`user_credentials` records, and restore a database backup if credentials were
lost entirely.
