# 6. Deploy staging and production

Deployment is explicit and reviewed. No command in this chapter creates a
Cloudflare resource; resources are created in chapter 3 and the plan gate only
verifies readiness.

## Pre-deploy checklist

```bash
# working directory: the generated customer repository
npm ci --ignore-scripts
npm run validate      # scaffold + environment correctness (all environments)
npm run typecheck
npm run build         # typechecks and bundles the SPA into apps/web/dist
npm test              # this application's behavioral suite
```

## The deploy plan gate

```bash
# working directory: the generated customer repository
npm run deploy:plan -- production
```

The plan refuses to approve a deployment while:

- `hostnameReviewed` is still `false` or the hostname is a scaffold value;
- the Access team is the `replace-access-team` placeholder (only if Access is used);
- two environments share any resource (Worker name, D1 id, bucket, audience);
- the D1 database id is a zero UUID.

After replacing the scaffold values in `infra/environments/<env>.json` and
setting `hostnameReviewed: true`, the plan prints the exact wrangler command
for that environment. A plan never deploys.

## Deploy

```bash
# production (Wrangler base configuration)
npx wrangler deploy --config apps/worker/wrangler.jsonc

# staging (named wrangler environment)
npx wrangler deploy --config apps/worker/wrangler.jsonc --env staging
```

First deployment of an environment: apply the migrations (chapter 3) to that
environment's D1 **before** initializing, then open the hostname and run
first-run setup (chapter 4) within the setup window. Configure `SETUP_TOKEN`
before exposing the hostname to keep that window locked.

## Post-deploy verification

```bash
curl -s https://your-hostname/healthz            # {"status":"ok", ...}
curl -s https://your-hostname/api/setup/status   # {"initialized":true,...} after setup
```

Also verify in a browser: sign-in works, an unauthenticated `/api/session`
request fails closed, and static routes serve the SPA.

## What is not automated

- Creating D1/R2 resources, DNS records and Access applications (chapter 3).
- Applying migrations (explicit, chapter 3 and 11).
- Backups (chapter 12).

Continue to [Add users and assign roles](07-users-and-roles.md).
