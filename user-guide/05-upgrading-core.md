# 5. What happens when the Lumi core is updated?

Customers do not change or deploy automatically when the shared Lumi core changes. Each customer repository upgrades explicitly through a reviewable Git diff.

## 1. Upstream creates the release

From the platform repository, after committing the reviewed core changes:

    npm run check
    npm run core:pack

The release contains exact tarballs for:

- @runlumi/core
- @runlumi/cloudflare
- @runlumi/ui

It also contains a provenance manifest with the source commit, release digest, extension API version, and migration checksums. Packaging does not publish packages or create Cloudflare resources. It refuses a dirty platform tree by default.

## 2. Customer previews the upgrade

In the customer repository:

    npm run upgrade -- --check --from /path/to/lumi-bi/artifacts/core

The plan reports:

- current and target core versions;
- target source commit;
- control and tenant migration counts;
- customer-owned migrations that will remain;
- extension API compatibility.

No files are changed in check mode.

## 3. Customer applies the upgrade

The customer repository must have a clean Git working tree:

    npm run upgrade -- --from /path/to/lumi-bi/artifacts/core

The updater verifies artifact hashes and then updates the exact vendored packages, package metadata, package lock, and lumi.lock.json. It installs with npm ci --ignore-scripts and does not contact a registry for the supplied core artifacts.

The updater refuses:

- dirty customer repositories;
- invalid or tampered artifact hashes;
- unsafe artifact paths;
- incompatible core-major upgrades;
- extension API changes that have no migration;
- inconsistent package-lock metadata.

## What is preserved?

Customer-owned files are preserved:

- customer/
- customer/migrations/
- apps/web/src/
- apps/worker/src/
- infra/
- customer-owned docs, reports, mappings, tests, and workflows

Generated files such as package.json, package-lock.json, lumi.lock.json, Worker configuration, frontend configuration, and CI templates can change. Review their diff deliberately. A core upgrade is not permission to overwrite customer customizations silently.

## 4. Validate the upgraded customer

Run:

    npm run validate
    npm test
    npm run typecheck
    npm run build
    npm run deploy:plan production

For a multi-environment customer, validate and plan every environment that will be released.

The two-customer acceptance proof also verifies that materially different customer applications retain their custom pages, metrics, reports, tests, and deployment identity through a synthetic core upgrade.

## 5. Apply migrations and deploy

Core migrations are immutable and ship inside node_modules/@runlumi/core/migrations. Apply them before or with the Worker version that depends on them. Customer migrations remain in customer/migrations and are owned by the customer repository.

After the operator reviews the migration and deployment plan, deploy the Worker using the customer’s reviewed environment configuration.

## Rollback limits

Reverting the Worker version does not:

- reverse a database migration;
- undo an external action;
- restore a deleted or changed source record;
- refund money.

Use additive expand/contract migrations so the previous Worker remains compatible with the migrated schema. Preview rollback behavior against the actual migrated database before deploying it.

## Evidence boundary

A successful upgrade plan proves only that the repository can be upgraded safely. It does not prove live provider coverage, merchant reconciliation, Cloudflare production health, or customer approval. Record those as separate evidence.
