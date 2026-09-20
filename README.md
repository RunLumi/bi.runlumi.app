# Lumi Commerce Intelligence

**Know which money, stock and operating exceptions need attention. Explain the evidence.**

Lumi connects commerce systems without replacing them. The target products are
**Money Truth**, **Stock Decisions**, and **Operations Exceptions**; Executive Pulse
summarizes them, and Ask Lumi will explain the same governed metric results.

Start with the [commerce specifications](docs/specs/README.md), then the
[delivery gates](docs/specs/commerce/27-delivery-plan-and-decision-gates.md).

## What runs today

**Foundation preview, not merchant-verified or Cloudflare production-certified.**

- Separate central control Worker/D1 for identities, memberships, tenant routes,
  license entitlements and configuration releases. No commerce D1 bindings there.
- Bounded cell API with per-tenant serving D1, primary authorization checks,
  database identity/route fencing, role checks and no browser-selected binding.
- React/Vite Vietnamese workspace with truthful commerce capability states,
  a working operations-cost dashboard, sources/provenance and declarative editor.
- Dashboard queries run in one bounded D1 batch with one configuration and known
  source snapshot vector. Source completeness is explicitly unverified.
- Operator-registered immutable R2 packs, tenant-specific activation and revision/
  route-epoch conflict checks. Git-managed dashboards cannot be overwritten by UI.
- AI profile references may be configured and tenant-validated; **no inference,
  model billing, budget enforcement or external agent action is implemented**.
- Small approved operations snapshot importer, immutable evidence, idempotency,
  atomic publication, safe watermark rules and tested capacity/cash distinctions.

**Not shipped:** live Nhanh/Haravan/Shopee adapters, commerce canonical facts and
reconciliation, margin/settlement/inventory calculations, source-auth onboarding,
field/row finance permissions, Ask Lumi, autonomous actions, raw SQL, exports,
self-service billing, automated Git attestations, or production migration/fleet
orchestration. No synthetic commerce chart is presented as a working integration.

See [PR #2 scope and acceptance mapping](docs/pr2-commerce-alignment.md) and
[validation](VALIDATION.md). Specifications are contracts, not evidence of delivery.

## Run the local demo

Node.js 22.16.0 (`.nvmrc`) and npm are required. Both package graphs are locked.

```bash
npm run setup                 # npm ci for root + frontend; lifecycle scripts off
npm run check                 # core TypeScript, real SQLite/WebCrypto tests
npm run check:commerce        # owned spec IDs, links, independent commerce oracles
npm run check:web-deps        # locked dependency provenance/license admission
npm run dev                   # builds React assets, then starts local demo
```

Open `http://127.0.0.1:8787`. Home shows the target decision products and their
unavailable capabilities. **Chi phí thao tác** opens the working operations-cost
pack. Tenant A has **74 released hours and zero recorded cash savings**; the
sample is deliberately not a customer case study.

The demo harness is loopback-only and memory-only. It cannot be enabled by a
production Worker flag. Switching identity creates a fresh query cache. A tenant
owner is not a platform operator; the operator sees control metadata, not facts.

For frontend iteration, start the local API and `npm run dev:web` in a second
terminal. For browser regression tests after `npm run build:web`:

```bash
./apps/web/node_modules/.bin/playwright install chromium
npm --prefix apps/web run test:e2e
```

## Architecture

```text
Browser -> Cell Worker -> private CONTROL service binding
                            -> Access re-verification
                            -> central control D1: current membership, license, route
                            -> private PACKS R2: immutable active bundle
           |
           -> allowlisted binding + tenant identity + route epoch
           -> tenant D1: facts, snapshots, UI dashboards, local audit
           -> private SOURCES R2: tenant-prefixed source evidence
```

One product repo; isolated data and versioned configuration. A cell compromise
still exposes its bound resources. Sensitive deployments can use dedicated cells;
this is not a claim of PostgreSQL RLS or complete per-tenant compute isolation.

[Architecture](docs/architecture.md) · [API](docs/api.md) ·
[Tenant packs](docs/tenant-packs.md) · [Deployment](docs/deployment.md) ·
[Security](SECURITY.md) · [Design](DESIGN.md) · [Icons](ICON.md)

## Cloudflare deployment

No deployment or billable Cloudflare resources are created by repository CI.
Generate an inventory-specific plan with `npm run cf:config -- .local/cell.json`,
then follow the [runbook](docs/deployment.md): migrate both planes, build assets,
deploy the private control Worker **before** the cell, and test real bindings.

The control service has no public route. All attached cells currently share the
same reviewed Access application audience. Generated SQL does not invent a
commercial license or grant operator access.

## License

Original Lumi code remains private/reserved under [LICENSE](LICENSE).
Dependencies retain their notices; builds include `THIRD_PARTY_NOTICES.txt`.
See [dependency provenance](THIRD_PARTY_NOTICES.md). No relicensing is inferred
from any other RunLumi project.
