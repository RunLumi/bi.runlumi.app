# Customizing a Lumi BI customer application

A customer application is a private repository generated from `starter/customer`.
It customizes behavior through supported configuration and reviewed application
code. It never edits core internals. The core is a versioned dependency.

Canonical decision: [ADR 0010](docs/adr/0010-customer-application-repositories.md).

## What lives where

| Location | Owned by | Change rule |
| --- | --- | --- |
| `customer/manifest.ts` | Customer | Identity, enabled modules, brand. Reviewed diff. |
| `customer/ui/` | Customer | Navigation entries, pages, widgets, brand tokens. |
| `customer/data/` | Customer | Mappings, approved namespaced metrics, connector extensions. |
| `customer/ai/` | Customer | Prompt sources, provider/model references, budgets. |
| `customer/workflows/` | Customer | Decision rules and supported action definitions. |
| `customer/migrations/` | Customer | Owned tables/indexes, separate ledger. |
| `customer/tests/` | Customer | Executable synthetic acceptance suite (`npm test`). |
| `infra/` | Customer | Non-secret deployment inventory per environment. |
| `apps/web`, `apps/worker` | Customer | Thin composition entries. |
| `packages/*`, `apps/control` | Upstream | Never edited in a customer repository. |

## Add a custom page

1. Create the page in `customer/ui/pages.tsx`, composed from `@runlumi/ui`:

   ```tsx
   import type {AppPage} from '@runlumi/ui/app.tsx';
   import {Card,CardTitle,CardHeader,CardContent} from '@runlumi/ui/components/ui/card.tsx';

   function StockPage({tenant}:{tenant:{id:string}}){
     return <Card><CardHeader><CardTitle>Tồn kho theo cửa hàng</CardTitle></CardHeader>
       <CardContent><p>Phạm vi: {tenant.id}</p></CardContent></Card>;
   }

   export const customerPages:AppPage[] = [
     {path:'/stock', label:'Tồn kho', nav:({tenant})=>!!tenant, render:({tenant})=>stock(tenant)}
   ];
   function stock(tenant:{id:string}|null){return tenant?<StockPage tenant={tenant}/>:<p>Chọn doanh nghiệp.</p>;}
   ```

2. Notice the page already applies to the composed app; `customerPages` is merged in
   `apps/web/src/App.tsx`. A reserved path (`/`, `/money`, `/commerce-data`,
   `/operations`, `/configuration`, `/control`) is rejected by `npm run validate`.
3. Add the path to `lumi.lock.json` `customerPages` so the validator tracks it.
4. Run `npm run validate && npm run typecheck && npm run build` and
   `npm test` (the executable template suite in `customer/tests/`).

## Add a custom metric

Custom metrics are **namespaced and additive**. They may add a new metric or
explicitly version a meaning; they may never silently redefine a reviewed shared
metric such as sales, profit or cash.

1. Use the namespace declared in `customer/manifest.ts` `extensions`.
2. Register it in `customer/data/metrics.ts` with `id: '<namespace>.<name>'`.
3. Implement its server computation in `customer/data/server-metrics.ts` with the
   same id; `npm run validate` rejects a declared metric that has no executable
   server registration.
4. A runtime metric reads through the governed query API with a reviewed metric ID.
   It does not read the database directly and never supplies SQL.
5. Run `npm test` — the template suite derives its expected values from the
   connector's returned envelope keyed by your metric's `source.from[0]`, so a
   mislabeled source fails loudly instead of passing by echo.

Changing a *shared* metric meaning requires an upstream new version with regression
evidence, not a customer edit.

## Add a connector adapter

Adapters run server-side in the customer Worker and return a raw export envelope to
the core receipt pipeline (`customer/data/connectors.ts`). They do not expose SQL to
a browser or model and never receive credentials from the browser. Transport must be
a supported, certified transport; an uncertified adapter stays visibly uncertified
and is not presented as a working live integration. The template suite pulls the
adapter through the composed API and asserts exact envelope metadata, idempotent
replay, exact derived metric values and viewer denial — keep the fixture
deterministic so those expectations stay honest.

## Add an AI profile

`customer/ai/profile.ts` selects interpretation and presentation only. Prompts in
`customer/ai/prompts/` may change how results are explained; they never change
deterministic finance rules or permissions and never supply SQL. Inference is not
enabled by configuration alone; this repository does not claim working inference.

## Brand overrides

Use `customer/ui/theme.ts`, which sets only documented CSS custom properties
(`--primary`, `--background`, ...). Do not use global CSS overrides that change core
accessibility, state semantics or layout contracts.

## Rules that cannot be customized away

- Authentication (Cloudflare Access), authorization (roles/entitlements/field
  scope) and audit handling are core. A successful login is not finance, export,
  configuration or admin permission.
- Exact money, unknown-versus-zero, cost history, deduplication, snapshot
  consistency and reviewed publication are core.
- Reserved routes and shared metric meanings cannot be silently replaced.
- Disabling a module in `customer/manifest.ts` removes its server routes
  (`403 MODULE_DISABLED`), not just navigation entries; the template suite
  asserts this in both directions.
- No arbitrary runtime plugins, `eval`, remote modules or unreviewed scripts.
- The core may not import customer code; public package interfaces are the only
  dependency direction.
