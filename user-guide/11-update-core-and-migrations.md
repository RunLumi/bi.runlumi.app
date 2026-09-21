# 11. Update core and apply migrations

Core updates arrive as exact, checksum-verified tarballs and are applied by a
reviewed updater that refuses unsafe states and produces a reviewable Git diff.

## Check for an update

```bash
# working directory: the generated customer repository
npm run upgrade -- --check --from /path/to/new/artifacts/core
```

Prints the upgrade plan: current → target version, migration counts,
extension-API compatibility, template changes. `--check` never writes.

## Apply an update

```bash
# working directory: the generated customer repository
git status --porcelain        # must be clean; the updater refuses dirty trees
npm run upgrade -- --from /path/to/new/artifacts/core
```

The updater, in order:

1. verifies the repository is clean and is a real Git repository;
2. verifies each artifact's sha256 against the release manifest before writing;
3. gates on compatibility (major jumps and extension-API changes are refused);
4. copies the verified tarballs into `vendor/`, updates `lumi.lock.json` and
   the `@runlumi/*` entries of `package-lock.json` in place — **no registry
   resolution**;
5. leaves everything under `customer/` and your `apps/` composition
   untouched; template changes are reported separately for manual review.

Then review the Git diff, revalidate and rebuild:

```bash
npm run validate && npm run typecheck && npm test && npm run build
git add -A && git commit -m "core upgrade N -> N+1"
```

## Apply migrations after an update

The upgrade reports the installation migrations the new release carries. Apply
any new ones explicitly, in order:

```bash
# working directory: the generated customer repository
npx wrangler d1 execute DB --remote --config apps/worker/wrangler.jsonc \
  --file node_modules/@runlumi/core/migrations/installation/<new>.sql
```

Migrations are additive; the updater never touches your database.

## Updater-owned vs customer-owned files

| Updater-owned | Customer-owned (preserved byte-for-byte) |
| --- | --- |
| `vendor/*` tarballs + manifest | `customer/**` (pages, metrics, migrations, tests) |
| `lumi.lock.json` core section | `lumi.lock.json` customerPages/extensions |
| `@runlumi/*` entries of `package-lock.json` | your other dependencies |
| template files (reported for manual merge) | `apps/web/src`, `apps/worker/src` composition |

## Partial update failure

The updater writes vendored artifacts first, then lock updates, and reports
exactly what it changed. If a run is interrupted: restore `vendor/` and the
two lockfiles from Git (`git restore vendor lumi.lock.json package-lock.json`)
and re-run. Because everything is committed before upgrading, recovery is
always `git restore` + retry. A failed update never touches your database or
your deployed Worker.

Continue to [Back up, restore and roll back](12-backup-restore-rollback.md).
