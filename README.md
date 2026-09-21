# Lumi BI

Lumi BI is a self-hosted operational reporting application for one installation.
Each installation owns its Worker, D1 database, private R2 bucket, users, source
records, dashboards, and audit history. The application never asks a request to
choose another installation or database.

## Install

```bash
npm run setup
npm run check
npm run dev
```

Open `http://127.0.0.1:8787`, initialize the installation, create its first
administrator, add users, register a source, import a bounded snapshot, and open
the dashboard. The local adapter uses synthetic data only.

## Deploy

Create a repository from the starter, configure one fixed `DB` D1 binding and one
private `SOURCES` R2 binding, apply every `migrations/installation/*.sql` in order,
build the React assets, and deploy the Worker to the installation owner's
Cloudflare account. Access or another identity provider may authenticate users,
but no Lumi-operated service is required at request time.

## Update and recover

```bash
npm run core:pack
npm run upgrade -- --check --from ../artifacts/core
npm run upgrade -- --from ../artifacts/core
npm run check
```

Review the Git diff, back up D1 and R2, apply the installation schema changes,
run tests, and deploy only after review. Package rollback is a real artifact
rollback; a schema downgrade requires restoring a compatible database backup.

The core is split into versioned packages under `packages/*`; installation code,
React pages, server extensions, mappings, connectors, and tests remain outside
core internals. The complete operator journey lives in
[the user guide](user-guide/README.md) (13 chapters, from requirements to
troubleshooting). Capability-to-evidence mapping:
[delivery checklist](docs/delivery-checklist.md). Also see
[customization](CUSTOMIZATION.md), [deployment](docs/deployment.md), and
[security](SECURITY.md).

```bash
node scripts/workerd-check.mjs             # packaged core under real workerd + local D1
node scripts/acceptance-two-customers.mjs  # two customer repos from one packaged release
```

## License

The product remains source-available under [Elastic License 2.0](LICENSE).
Third-party notices and the licensing policy are unchanged.
