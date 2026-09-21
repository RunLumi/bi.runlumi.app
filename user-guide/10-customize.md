# 10. Customize pages, reports and server behavior

Everything customer-specific lives in **your** repository under `customer/`,
composed through public `@runlumi/*` interfaces. You never edit package
internals; upgrades preserve these files.

## Custom React pages

Edit `customer/ui/pages.tsx` (copied into your repo). A page is a real React
component registered in the navigation:

```tsx
import type {AppPage} from '@runlumi/ui/app.tsx';
import {Card,CardHeader,CardTitle,CardContent} from '@runlumi/ui/components/ui/card.tsx';

function MyPage({user}:{user:NonNullable<AppPage['render'] extends (ctx:infer C)=>unknown?C:{user:import('@runlumi/ui/lib/api.ts').InstallationUser}}>){return null;}
```

Concrete example (ships in the starter): `/customer-note` renders core Card
components and reads the session-scoped user. Reserved routes (`/`, `/money`,
`/operations`, `/configuration`, `/control`, `/admin`, `/api/*`) cannot be
shadowed; `npm run validate` rejects collisions before deployment. Register
routes in `lumi.lock.json` under `customerPages`.

## Custom TSX reports

Saved commerce insights can be promoted (**Đề xuất báo cáo TSX**) into a
reviewed `.tsx` proposal under `customer/reports/`. The proposal contains the
query definition as data; values are resolved from the publication at runtime.
Copy the reviewed file into your repository and commit it — promotion itself
never writes to your repository.

## Server metrics

`customer/data/metrics.ts` declares customer metrics (namespaced under
`customer.`); `customer/data/server-metrics.ts` registers executable
extensions that receive only the bounded semantic query compiler — never raw
SQL or database bindings:

```ts
export const customMetricExtensions:readonly CustomMetricExtension[]=[{
 id:'customer.warehouse_hours_saved',version:1,
 async execute({query}){
  const response=await query({metrics:['released_hours'],from:'2026-09-01',to:'2026-10-01',groupBy:'none'});
  const row=(await response).results[0]?.data[0];
  return {value:row&&row.matched_rows?String(row.released_hours):null,unit:'hours',evidence:null};
 }
}];
```

NULL-not-zero is your responsibility at this boundary: an empty installation
must surface null, not 0.

## Connectors, decision rules, workflows

- `customer/data/connectors.ts` — read-only connector adapters for the
  authorized-export transport.
- `customer/workflows/decisions.ts` — the reviewed decision-rule catalog;
  rules are advisory (`externalAction: false` is enforced).
- `customer/migrations/` — your own additive SQL migrations.
- `customer/tests/` — behavioral tests run by `npm test`; the shipped suite
  exercises setup, sign-in, roles and the commerce journey against the
  packaged artifacts.

## Branding

Logo and labels are set in `apps/web/src/App.tsx` (`brand`, `labels`) using
the core composition API — layout, auth and caching behavior stay in core.

## What custom code may and may not do

- **May**: call session-scoped `/api` endpoints, use core UI components,
  register metrics/connectors/rules, add migrations and tests.
- **May not**: import core internals (enforced by boundary checks), define
  executable SQL at runtime, or execute model/browser output as code. Reviewed
  custom code runs with application privileges; runtime model output is data,
  never code.

Continue to [Update core and apply migrations](11-update-core-and-migrations.md).
