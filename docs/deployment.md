# Deployment

One installation = one Worker + one hostname + one D1 database + one private R2
bucket, all owned by the customer. See the
[user guide](../user-guide/06-deploy-staging-and-production.md) for the full
journey; the essentials:

1. Generate the installation repository from the starter (`npm run customer:new`
   in the platform repository) — it consumes exact packaged core artifacts.
2. Create the environment's D1 database and private R2 bucket in the owner's
   Cloudflare account and record them in `infra/environments/<env>.json`.
3. Apply `migrations/installation/*.sql` from the packaged core to the D1
   database explicitly, in order.
4. `npm run validate && npm run build && npm test` in the installation
   repository, then `npm run deploy:plan -- <env>` as the review gate. A plan
   creates no Cloudflare resource.
5. Deploy with `npx wrangler deploy --config apps/worker/wrangler.jsonc`
   (production base; `--env <name>` for other environments).
6. Open the hostname, run one-time setup (administrator email + password; with
   `SETUP_TOKEN` configured the setup requires that token), then verify
   `/healthz`, `/api/setup/status`, sign-in, and a query.

Optional Cloudflare Access authenticates in addition to the local user model;
it is never required for the default journey. No deployment requires a
Lumi-operated service, and no request or job can select another installation's
database or bucket.
