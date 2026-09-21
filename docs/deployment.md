# Deployment

1. Create or clone the installation repository.
2. Create its D1 database and private R2 bucket in the owner's Cloudflare account.
3. Put the fixed resources in `apps/worker/wrangler.jsonc` under `DB` and `SOURCES`.
4. Configure authentication secrets or an optional identity-provider integration.
5. Apply `migrations/installation/0001_initial.sql`.
6. Build the web assets and deploy the Worker.
7. Open the hostname, initialize the installation, create the administrator, and
   verify `/api/session`, `/api/sources`, `/api/imports`, and `/api/query`.

No deployment requires a Lumi account or a Lumi-operated runtime service. A
missing binding or invalid identity must produce a clear failure.
