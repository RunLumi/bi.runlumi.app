# Lumi BI

**One set of business definitions. Many customer dashboards. Evidence behind every number.**

Cloudflare-first BI for RunLumi: connect existing systems, publish trustworthy
metrics, customize dashboards without product forks, and measure whether AI
actually improves operating economics.

## Current status

**Bootstrap 0.1.0, not production-certified.** This repository contains a runnable
multi-tenant vertical slice, not a full Databricks replacement, a general warehouse,
or a finished self-service BI product.

Implemented: Worker-compatible API, D1-shaped repositories, per-tenant database
routing, membership checks, narrow Cloudflare Access JWT verification, R2 snapshot
archive interface, atomic D1 publication, bounded semantic queries, configurable
dashboards, optimistic edits, and a Vietnamese demo UI. Local tests execute real
SQLite and generated RSA signatures through the same application services.

Not yet implemented: real ERP/Sheets connectors, production SSO validation,
workerd integration tests, asynchronous bulk ingestion, drag-and-drop canvas,
R2 SQL warehouse adapter, dashboard result cache, NL-to-query, export links,
billing, per-tenant query rate control, production deployment or GitHub publishing.
See [validation](VALIDATION.md) for what was actually run.

## Run the demo

Requires Node.js 22.16+ and npm. The pinned toolchain is in `.nvmrc`.

```bash
npm ci --ignore-scripts
npm run check
npm run dev
```

Open `http://127.0.0.1:8787`. Choose an owner, editor or viewer for two synthetic
businesses. Change dates, inspect metric definitions and source hashes, duplicate
a dashboard and edit its declarative JSON. The viewer cannot mutate via the API.

The demo server lives under `scripts/`, uses memory-only SQLite, listens on
loopback, and cannot be enabled through a flag in the production Worker.
`npm run dev` and `npm test` require no third-party runtime packages; `typecheck`
uses the pinned TypeScript development dependency. Node may print experimental
SQLite/type-stripping warnings on this toolchain.

## Architecture in one picture

```text
Shared codebase / immutable release
         |
         +-- Deployment cell / Cloudflare Worker + Static Assets
              |-- Access identity verification
              |-- control D1: membership + tenant-to-binding registry
              |-- semantic query compiler + dashboard definitions
              |-- tenant A D1: curated facts, active snapshot, dashboard config
              |-- tenant B D1: curated facts, active snapshot, dashboard config
              `-- private R2: tenant-prefixed snapshot archives

Next: Queues + Workflows for ingestion; analytical adapter when D1 serving marts
are insufficient; same semantic contract for dashboards and lumi-agents.
```

Database isolation is not complete compute isolation: the cell's Worker can access
all of its bound tenant databases. A sensitive customer can get a dedicated cell
without receiving a fork of the application. No PostgreSQL RLS is claimed for D1.

## First pack: operations cost

The synthetic sample deliberately shows **74 released hours and 0 recorded cash
savings** for tenant A. Runtime and support costs therefore produce a negative net
cash benefit. Capacity, avoided future hiring and realized cash are different
outcomes. A persuasive dashboard must not blur them.

The bootstrap supports one aggregate per source/workflow/business day, VND,
explicit half-open date ranges, and source watermark/hash metadata. Seven static
metric definitions and three widget kinds are enough to test the architecture.
This is not yet arbitrary customer SQL or metric authoring.

## Repository map

```text
apps/api/src/          Worker entry, auth, tenancy, ingestion, query API
apps/web/             Static Vietnamese dashboard and config editor
packages/core/        Strict contracts, semantic registry, SQL compiler
migrations/control/   Tenant registry and membership schema
migrations/tenant/    Curated facts, snapshot, dashboard and audit schema
packs/operations-cost/ Reviewed reusable dashboard definition
fixtures/             Synthetic data only
scripts/              Local harness, validation and safe bootstrap tools
infra/                Inventory example; generated config is gitignored
tests/                Actual SQLite, WebCrypto and contract tests
docs/                 Architecture, decisions, rollout and evidence
```

## Publish to the requested empty GitHub repository

The bootstrap was prepared offline. It has **not** been pushed to GitHub.
Use your existing Git credentials and configured Git author:

```bash
npm run init:github
npm run init:github -- --push
```

The first command is a dry run. The second checks that
`https://github.com/RunLumi/lumi-bi.git` is still empty, runs checks, initializes
local `main`, commits and pushes. It refuses existing history and never force
pushes. If the remote is no longer empty, use a normal reviewed branch instead.
Do not send GitHub or Cloudflare tokens to a chat or commit them.

## Cloudflare deployment

[Deployment guide](docs/deployment.md) describes provisioning, Access setup,
per-tenant migrations, generated bindings and the first authenticated canary.
The generator writes config; it does not provision resources or deploy.

```bash
npm run cf:config -- .local/cell.json
```

## Read first

[AGENTS.md](AGENTS.md) · [Architecture](docs/architecture.md) ·
[Cloudflare choices](docs/cloudflare.md) · [Semantic contract](docs/semantic-contract.md) ·
[Security](SECURITY.md) · [Roadmap](docs/roadmap.md) · [Tasks](TASKS.md) ·
[Primary references](docs/references.md)

## License

Original code remains private/reserved under [LICENSE](LICENSE). No public
relicensing is inferred from other RunLumi projects. Dependencies keep their own
terms; see [third-party notices](THIRD_PARTY_NOTICES.md).
