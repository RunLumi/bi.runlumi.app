# 12. Back up, restore and roll back

## Back up (scheduled, manual procedure)

D1:

```bash
# working directory: the generated customer repository
mkdir -p backups
npx wrangler d1 export DB --remote --config apps/worker/wrangler.jsonc \
  --output backups/d1-$(date +%F).sql
```

R2: export the sources bucket with the tool of your choice (for example
`rclone sync` against the S3-compatible R2 endpoint, or the Cloudflare
dashboard). The bucket holds immutable raw evidence — its objects are
content-addressed by hash, so a partial restore cannot corrupt referenced
evidence, but missing objects make normalization fail closed
(`RAW_EVIDENCE_UNAVAILABLE`).

Also commit the repository state (`lumi.lock.json`, `vendor/`) so code and
schema-version are recoverable together.

## Restore

```bash
# working directory: the generated customer repository
npx wrangler d1 execute DB --remote --config apps/worker/wrangler.jsonc \
  --file backups/d1-2026-09-21.sql
```

Restoring a backup restores the schema version **at backup time**. If the
Worker code is newer, re-apply the migrations shipped since the backup —
they are additive, so this converges the schema without rewriting data.
Never run the application against a schema older than its code expects:
migrations first, then deploy.

## Roll back code (real artifact rollback)

Code rollback is a **package artifact rollback**, not a version-label edit:

```bash
# working directory: the generated customer repository
npm run upgrade -- --from /path/to/previous/artifacts/core
# re-apply the same review steps as an upgrade (diff, validate, test, build)
git commit -m "roll back to core N"
npm run build
npx wrangler deploy --config apps/worker/wrangler.jsonc
```

The lock records the rolled-back version; `validate` and `build` prove the
rolled-back state is coherent. A schema-compatible rollback works with the
current database because migrations are additive: older code ignores newer
tables.

## Hard limits (stated plainly)

- **A database migration is not reversed.** If a rollback must precede a
  migration, restore the matching database backup instead — never edit the
  schema by hand.
- Deployed-Worker version pinning (`wrangler rollback`) is a Cloudflare-side
  operation and is not wrapped by this toolchain.
- The application never deletes or rewrites an existing customer database
  automatically — a "fresh start" means provisioning a new database and
  explicitly pointing the environment inventory at it, after backing up the
  old one.

Continue to [Troubleshooting and operational handoff](13-troubleshooting-and-handoff.md).
