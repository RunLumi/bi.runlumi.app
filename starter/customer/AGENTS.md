# Customer application engineering guidance

This repository is one customer's Lumi BI application. It consumes the shared Lumi
core as versioned packages and customizes through public interfaces. It is not a
fork of the platform.

## Ownership

- **You own:** `customer/`, `infra/`, `docs/`, `apps/web/src`, `apps/worker/src`.
- **Upstream owns:** everything under `node_modules/@runlumi/*` and the platform
  `apps/control` service. Do not patch package internals or copy core code here.
- **Generated files** (`package.json`, `apps/web/{index.html,tsconfig.json,vite.config.ts}`,
  `apps/worker/wrangler.jsonc`, `lumi.lock.json`, `.github/workflows/verify.yml`)
  come from the template. Change them deliberately and expect a reviewed upgrade diff.

## Commands

```bash
npm ci --ignore-scripts        # install exact vendored core + locked deps
npm run validate               # config, identity, reserved routes, compatibility
npm run typecheck              # TypeScript against installed core packages
npm run build                  # validate + typecheck + Vite build
npm run dev                    # loopback-only synthetic server (no cloud calls)
npm run upgrade -- --check     # report an available core upgrade
npm run deploy:plan production # deployment plan; creates no resource
npm test                       # customer tests under customer/tests
```

## Change rules

1. **Extend, do not redefine.** Custom metrics use your manifest namespace and never
   silently change sales, profit or cash. A shared-metric change is an upstream
   version, not a customer edit.
2. **Reserved routes and namespaces are off limits.** `/`, `/money`,
   `/commerce-data`, `/operations`, `/configuration`, `/control` and the `lumi`/
   `commerce` metric namespaces are core-owned; `npm run validate` rejects collisions.
3. **No arbitrary runtime code.** No `eval`, remote modules, plugins or unreviewed
   scripts. Extensions are reviewed TypeScript/React compiled into the Worker.
4. **No secrets in Git.** Credentials live in Cloudflare secrets. `customer/manifest.ts`
   and `infra/*.json` are non-secret metadata only.
5. **Migrations are additive and owned.** `customer/migrations` may add owned tables
   and indexes; it never alters or drops core schema.
6. **Deployment identity is server-owned.** `CUSTOMER_ID`, `DEPLOYMENT_ID` and the
   `SERVING` binding come from deployment configuration, never from a request.
7. **Keep the visual language — build with shadcn and Base UI.** Frontend work uses
   shadcn/ui on Tailwind v4 with Base UI primitives: compose screens from the shared components, tokens
   and states in `@runlumi/ui` (`components/ui`, cva variants, `cn`), and add
   new pieces as shadcn-style components rather than bespoke CSS or one-off
   markup. Override brand only through theme tokens in `customer/ui/theme.ts`
   and `tailwind.css`. Do not add global CSS overrides that change core
   accessibility or state behavior.

## Before you ship

Run `npm run validate && npm run build`, then `npm run deploy:plan <env>`. Confirm
Access still protects the hostname and the serving database identity matches the
configured customer. A successful Access login is not finance, export, configuration
or administrator permission.
