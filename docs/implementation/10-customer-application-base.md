# 10 — Customer application base (reusable core, generated customers)

Status: implemented and locally verified. Date: 2026-09-20.
Canonical decision: [ADR 0010](../adr/0010-customer-application-repositories.md).

## What shipped

- **Three versioned packages** built from the former flat `packages/core` files and
  the `apps/api` application services:
  - `packages/core` — domain contracts (`contracts`, `semantics`, `licensing`,
    `tenant-pack`), governed commerce services (`commerce-*`), the application API
    (`api`, `query`, `ingest`, `tenant`, `control-client`), the customer
    configuration schema (`customer-config`) and the coordinated version
    (`version`).
  - `packages/cloudflare` — Access verification (`auth`), Worker assembly
    (`cell`), dedicated deployment identity and fence (`deployment`), and local
    test adapters (`testing`).
  - `packages/ui` — design system components, shared feature screens, data clients
    and the `createApp` composition API (`app.tsx`).
- **A minimal customer starter** at `starter/customer` and a generator,
  `npm run customer:new`, that emits a private-by-default application repository
  with `customer/`, `apps/web`, `apps/worker`, `infra/`, `docs/`, vendored exact
  core tarballs and `lumi.lock.json` provenance.
- **Enforceable boundaries**: `scripts/check-boundaries.mjs` (with non-vacuous
  negative tests in `tests/boundaries.test.mjs`) rejects application imports in
  core, server modules or node builtins in browser bundles, cross-package deep
  imports and upward dependencies.
- **Reproducible core delivery**: `npm run core:pack` builds deterministic tarballs
  and a `lumi-core-manifest.json` recording source commit, release digest,
  extension API version, template version and migration checksums. Migrations ship
  inside the core package. The command refuses a dirty tree.
- **Reviewed upgrade**: `npm run upgrade -- --check` (plan) and `npm run upgrade`
  (apply) in a customer repository. It refuses a dirty tree, rejects incompatible
  major/extension changes, reports migration deltas and preserves customer files.
- **Configuration validation**: `parseCustomerManifest`, `parseCustomerRoutes` and
  `assertCompatible` in `packages/core/src/customer-config.ts`, invoked by the
  customer `validate` command and CI.

## Verified environments

- **Local (this repository).** `npm run check` — package build, typecheck, 258+
  unit/SQLite tests, repository checks, boundary checks and the licensing gate.
- **Local workerd.** `node scripts/workerd-check.mjs` runs a thin Worker composed
  only from packaged artifacts under `wrangler dev` (local workerd, no account).
  6/6 checks: the packaged module graph evaluates; a missing or unconfigured Access
  token fails closed; an email/header shortcut never authenticates; an unknown API
  path returns JSON, not the HTML shell; static assets are served.
- **Dedicated deployment semantics.** `tests/dedicated-deployment.test.mjs` — the
  deployment fence rejects a foreign tenant id, identical business IDs cannot cross
  a swapped binding, viewer is denied owner-only routes, a revoked membership and a
  machine actor without an end-user identity fail closed, and the session lists
  only the configured customer.
- **Two-customer acceptance + upgrade.**
  `node scripts/acceptance-two-customers.mjs` — 10/10 checks: both applications
  install from real tarballs (not symlinks) and build without upstream source
  paths; each has distinct custom pages and namespaced metrics; a reserved-route
  collision and a bad customer id are rejected with diagnostics; a synthetic N+1
  core release upgrades both applications while customer files stay byte-identical;
  one customer's rollback to N leaves the other at N+1 and the migration-limit
  guidance is present.

## Remaining prerequisites (not claimed here)

- **Authenticated Cloudflare staging.** A real Access login, a real deployment to a
  customer hostname, real D1/R2/Queue bindings and real control authority. Local
  and workerd evidence is reported separately; no live certification is claimed.
- **Registry-published packages.** Packaging currently produces vendored tarballs.
  Publishing to a private scoped registry requires registry credentials and
  visibility confirmation and is not exercised here.
- **Customer-managed accounts.** Same-account service bindings are used. A
  customer-owned Cloudflare account would additionally require authenticated
  transport and is not implemented.
- **Dedicated account/IAM isolation.** Dedicated Workers are not complete isolation;
  residual account-wide blast radius is documented in ADR 0010.

## Feature gaps deliberately not closed

The reusable base does not implement live provider connectors, general commerce
semantic querying, forecasting, Ask Lumi inference, scheduled delivery or agent
execution. Those remain the C00–C27 feature work; this record covers the base
architecture only.
