# Update the core

Use the installation's reviewed artifact directory:

```bash
npm run upgrade -- --check --from ../artifacts/core
npm run upgrade -- --from ../artifacts/core
```

The updater verifies artifact hashes and compatible extension versions, updates
exact package tarballs and lockfiles, preserves installation files, and prints a
reviewable change. Apply any pending installation schema changes explicitly, run
tests, and deploy after review. A package rollback does not reverse a schema
change; restore a compatible D1 backup when required.
