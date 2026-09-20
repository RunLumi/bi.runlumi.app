# Lumi Commerce Intelligence

- landing page:     https://about.bi.runlumi.app
- platform:     https://bi.runlumi.app

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

- Authorized commerce export onboarding, durable raw receipts/outbox and immutable
  order, settlement and physical-stock normalization. Invalid business formats
  are quarantined; checksums and current source permissions are enforced.
- Owner-only normalization jobs now have durable tenant-D1 admission, idempotent
  replay, lease fencing and bounded retry/dead-letter state. This is a manual local
  consumer boundary; it is not a deployed Queue, scheduler or recovery claim.
- Reviewed cross-source identity mappings, declared independent control totals,
  immutable publication previews and compare-and-swap activation. Prior reports
  remain reproducible; unknown financial components remain unavailable.
- Money/stock review screens, deterministic observed-condition findings, an
  auditable decision register with positively verified outcomes, and authenticated
  CSV/JSON exports. No finding, decision state or payout gap fabricates recovered cash.

These commerce paths are a **bounded authorized-export workflow**, not a live
connector or full financial warehouse. Maximum 100 records/48 KB per raw file,
10 normalized source snapshots and 512 KB per published report. Orders use an
explicit tax basis and order-cohort recognition; no line/event-date P&L is implied.

**Not shipped:** live Nhanh/Haravan/Shopee adapters; large chunked source sync or
a deployed Queue/Workflow consumer;
line-level returns/refunds/COGS; general commerce semantic querying and field/row
finance permissions; demand forecasting/stock aging; marketing/customer cohorts;
Ask Lumi inference; scheduled delivery/embeds; agent execution; self-service
billing; automated Git attestations; production migration/fleet orchestration.
No synthetic commerce chart is presented as a working integration.

See the [implementation record](docs/implementation/README.md) for the complete
C00–C27 status and the next dependency-ordered work.
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
pack. Owners can open **Nguồn & bản nhập**, authorize a bounded source, use the
[synthetic interchange examples](examples/commerce/README.md), normalize, preview
and publish a report, then open **Số liệu thương mại**. Tenant A has **74 released hours and zero recorded cash savings**; the
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
Browser -> Customer application Worker -> private CONTROL service binding
   |                                       -> Access re-verification
   |                                       -> central control D1: membership, license, route
   |                                       -> private PACKS R2: immutable active bundle
   |  (dedicated deployment: fixed CUSTOMER_ID, hostname, Access audience, SERVING D1)
   -> SERVING D1: facts, snapshots, UI dashboards, local audit
   -> private SOURCES R2: customer-prefixed source evidence
```

One versioned product core (`packages/core`, `packages/cloudflare`, `packages/ui`).
One generated, private customer repository per customer, consuming exact released
core artifacts and customizing through public interfaces. A dedicated customer
deployment has its own Worker, hostname, Access audience, serving D1, R2 resources
and secrets, with no binding to another customer's data. Shared-core changes always
land upstream; customer applications never patch core internals.

A cell compromise still exposes its bound resources. Dedicated Workers are not
complete account/IAM isolation, and this is not a claim of PostgreSQL RLS or
complete per-tenant compute isolation.

```bash
npm run core:pack                     # deterministic tarballs + provenance manifest
npm run customer:new -- --customer acme --name "ACME" --dest ../acme-lumi
npm run check:boundaries              # enforce customer -> public core direction
npm run check:workerd                 # packaged Worker under real local workerd
npm run acceptance:two-customers      # two-customer install/build/upgrade proof
```

[Architecture](docs/architecture.md) · [Customer base (ADR 0010)](docs/adr/0010-customer-application-repositories.md) ·
[Customization](CUSTOMIZATION.md) · [Upgrading](UPGRADING.md) · [API](docs/api.md) ·
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

**Source-available and self-hostable under [Elastic License 2.0](LICENSE), not
OSI-approved open source.** Internal use and customization are permitted subject
to ELv2; qualifying hosted/managed services need additional rights.

[License scope](LICENSING.md) · [Usage examples](docs/licensing/usage-policy.md) ·
[Partners and customers](docs/licensing/commercial-framework.md) ·
[Contributing](CONTRIBUTING.md) · [Brand notices](TRADEMARKS.md)

Apache-2.0 is reserved for explicitly reviewed thin SDK/starter scopes; none is
licensed that way yet. The existing product is not dual-licensed under Apache.
Third-party components retain their [own notices](THIRD_PARTY_NOTICES.md).
Application and landing builds include `LICENSE.txt`, `NOTICE.txt` and
`THIRD_PARTY_NOTICES.txt`. Run `npm run check:licensing` to verify metadata and
notice boundaries. Packages retain `private: true`; no hosted service,
registry release or legal rights audit is implied.
