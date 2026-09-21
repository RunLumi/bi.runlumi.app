# Upgrading Lumi BI

Installations consume exact packaged core artifacts at build time. Run the
read-only update check, review artifact hashes and the Git diff, apply any
explicit installation schema change, run validation, and deploy manually.

```bash
npm run core:pack
npm run upgrade -- --check --from ../artifacts/core
npm run upgrade -- --from ../artifacts/core
npm run check
```

The updater owns only core package artifacts, core lock metadata, and package
lock entries. It does not overwrite pages, server extensions, branding, source
configuration, dashboards, or installation-owned migrations. A package rollback
restores actual package bytes; a schema rollback requires a compatible database
backup.
