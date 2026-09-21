# Operating this customer application

## Environments and identity

Each environment (`infra/environments/<env>.json`) owns distinct resources: Worker,
hostname, Access team/audience, serving D1 and private R2 bucket. `lumi.lock.json`
is **customer-level** — deployment identity never lives in the lock. The effective
Wrangler configuration (`apps/worker/wrangler.jsonc`) uses `production` as the base
and a named `env.<environment>` section per additional environment.

Deployment identity is **server-owned**: `CUSTOMER_ID`, `DEPLOYMENT_ID`, the `SERVING`
binding and the Access audience come from the reviewed deployment configuration, never
from a request. The serving D1 must declare the same customer/deployment/environment in
`serving_identity`; a swapped or foreign database fails closed with
`SERVING_IDENTITY_MISMATCH`.

## Deploy

1. `npm ci --ignore-scripts`
2. `npm run validate` — scaffold correctness for **every** environment (identity,
   reserved routes, wrangler/inventory agreement, resource distinctness).
3. `npm run build`
4. `npm run deploy:plan <env>` — the deployable-release review gate. It blocks while
   the hostname is unreviewed (`hostnameReviewed: false`), the Access team is a
   scaffold value, audiences are placeholder or reused, or D1 identity is a zero/missing
   UUID. A plan creates no Cloudflare resource.
5. Configure the customer-owned Access application and seed local membership and
   entitlement records in the serving D1. No Lumi-operated registration endpoint or
   runtime control service is required.
6. Apply core migrations from `node_modules/@runlumi/core/migrations`, then customer
   migrations from `customer/migrations`, to the serving D1.
7. Deploy the Worker:
   - production (base): `npx wrangler deploy --config apps/worker/wrangler.jsonc`
   - other environments: `npx wrangler deploy --config apps/worker/wrangler.jsonc --env <env>`
8. Verify: Access protects the hostname (including SPA routes and assets), the serving
   database identity matches `CUSTOMER_ID`, and `/healthz` reports readiness.

## Security posture

- Workers.dev and preview URLs are disabled in every environment's configuration.
- Browser requests are same-origin; mutations use the core origin/CSRF check.
- Only the packaged Access verifier authenticates a session against this customer's
  configured team and audience, with no email/header shortcut or development identity.
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

If local authority is unavailable the application fails closed: it does not serve
customer data on an unverified authorization. Investigate the customer-owned
membership/entitlement records and serving database identity before restoring access.
