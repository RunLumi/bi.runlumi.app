# Upgrading a customer application to a new core release

Canonical decision: [ADR 0010](docs/adr/0010-customer-application-repositories.md).

## The model

- The shared core ships as exact released artifacts (`@runlumi/core`,
  `@runlumi/cloudflare`, `@runlumi/ui`) built by `npm run core:pack` upstream.
- A customer repository records the exact version, source commit, release digest,
  extension API version, template version and migration checksums in
  `lumi.lock.json`.
- Upgrades arrive as reviewable changes. Customers may stay on an older supported
  version; a core upgrade does not force simultaneous fleet deployment because the
  control-plane interface stays explicit and versioned.

## Upstream: produce a release

```bash
npm run build:packages          # build all three packages
npm run core:pack               # tarballs + lumi-core-manifest.json in artifacts/core
```

`core:pack` refuses a dirty tree (commit first). The manifest records provenance and
per-file migration checksums. It never publishes and never contacts a registry.

## Customer: plan, then apply

```bash
npm run upgrade -- --check --from /path/to/artifacts/core   # plan only
npm run upgrade -- --from /path/to/artifacts/core           # apply
```

The command:

1. Refuses a dirty tree so the update is a reviewable diff.
2. Rejects an incompatible **core major** upgrade and any **extension API** change;
   both require a documented migration first.
3. Reports the migration counts in the target release and confirms customer-owned
   migrations are preserved.
4. Refreshes vendored tarballs, updates `lumi.lock.json` and exact `package.json`
   versions, then installs with `--ignore-scripts`.

It does not overwrite customer-owned files (`customer/`, `infra/`, `docs/`,
`apps/*/src`). Generated files (`package.json`, `apps/web/*`, `apps/worker/*`,
`lumi.lock.json`, CI workflow) follow the template; review their diffs.

## Validate and ship

```bash
npm run validate    # config, identity, reserved routes, compatibility
npm run typecheck   # against the installed packages
npm run build       # browser bundle from packaged core
npm run deploy:plan production
```

## Migrations and rollback

- Core migrations are immutable and checksummed and ship in the core tarball under
  `node_modules/@runlumi/core/migrations`. Apply them before or with the Worker
  version that depends on them.
- Customer migrations live in `customer/migrations` in a separate ledger and may add
  owned tables and indexes only.
- **Reverting a Worker version does not reverse a database migration, refund money
  or undo external actions.** Preview a Worker rollback against the still-migrated
  database; use expand/contract changes so the previous version stays compatible.

## Security patches and supported versions

- A security fix lands in the core once and is released as a patch version; support
  the current major and the previous minor during the window the owner defines.
- Because the extension API is intentionally small, a patch or minor core release
  should not require customer code changes; a major requires a migration guide.
