# Operating this customer application

## Environments

Each environment (`infra/environments/<env>.json`) has its own Worker, hostname,
Access audience, serving D1, private R2 bucket and secrets. Never reuse another
customer's or environment's resources.

## Deploy

1. `npm ci --ignore-scripts`
2. `npm run validate`
3. `npm run build`
4. Apply core migrations from `node_modules/@runlumi/core/migrations`, then customer
   migrations from `customer/migrations`, to the serving D1.
5. Deploy the Worker: `npx wrangler deploy --config apps/worker/wrangler.jsonc`.
6. Verify: Access protects the hostname (including SPA routes and assets), the
   serving database identity matches `CUSTOMER_ID`, and `/healthz` reports readiness.

No resource is created by `npm run deploy:plan`; it only prints the plan.

## Security posture

- Workers.dev and preview URLs are disabled in production configuration.
- Browser requests are same-origin; mutations use the core origin/CSRF check.
- Only the packaged Access verifier authenticates a session. Do not add an email or
  header shortcut, and do not enable a development identity in production.
- The Worker has a binding only to this customer's serving database and sources
  bucket; it has no binding to another customer's business data.
- Dedicated Workers in a shared Cloudflare account are **not** complete account/IAM
  isolation. Scope deployment tokens to this Worker's resources. A customer-managed
  account would additionally require authenticated transport; that is not
  implemented and must not be claimed.

## Rollback

Reverting the Worker version restores code, not data. A database migration is not
reversed, money is not refunded and external actions are not undone. Preview a
rollback against the migrated database before deploying it.

## Incident

If control authority is unavailable the application fails closed: it does not serve
customer data on an unverified authorization. Investigate the control service and the
deployment's route epoch before restoring access.
