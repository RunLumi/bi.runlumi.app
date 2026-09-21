# 2. Create your repository

A customer repository is generated from a reviewed starter plus exact, packaged
core artifacts. Generation is a local file copy: no registry, no GitHub
repository, no Cloudflare resource.

## Package the core (platform repository only)

In your checkout of the Lumi BI platform repository, on a clean, committed
tree:

```bash
# working directory: the Lumi BI platform repository
npm run setup        # one-time: installs dependencies for the repo and apps/web
npm run check        # typecheck, behavioral tests, repository and licensing gates
npm run core:pack    # builds and checksums the release into artifacts/core
```

`core:pack` refuses a dirty tree, so commit your reviewed changes first.

## Generate the customer repository

```bash
# working directory: the Lumi BI platform repository
npm run customer:new -- \
  --customer acme \
  --name 'Acme Synthetic' \
  --env production,staging \
  --dest /path/to/acme-bi
```

- `--customer` becomes your stable identity: Worker names, hostnames, database
  and bucket names derive from it.
- `--env` lists deployment environments; `production` is always included and is
  the Wrangler base configuration. Each environment gets its own Worker name,
  hostname scaffold, Access audience scaffold, D1 database and R2 bucket.
- `--dest` must not exist or must be empty.

The generated directory is a complete, independent Git repository containing:

- `apps/web` — the React application (compose your pages here);
- `apps/worker` — the Worker entry (register your server extensions here);
- `customer/` — your pages, metrics, connectors, decision rules, migrations,
  workflows and tests;
- `infra/environments/*.json` — per-environment deployment inventory;
- `vendor/` — the exact `@runlumi/*` tarballs and `lumi-core-manifest.json`
  with sha256 checksums;
- `lumi.lock.json` — the reviewed core release your application is pinned to;
- `scripts/` — `validate`, `build`, `upgrade`, `deploy:plan`, `dev`.

## First install

```bash
# working directory: the generated customer repository
git init && git add -A && git commit -m "initial customer application"
npm ci --ignore-scripts
npm run validate
npm run typecheck
npm run build
npm test
```

`npm ci` installs the vendored tarballs only — it never contacts the npm
registry for `@runlumi/*` packages and never resolves a different version.

Continue to [Configure database, storage, hostname and secrets](03-configure-resources.md).
