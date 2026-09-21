# 2. Create a new customer repository

The generator creates a complete local customer application from the current packaged core. Choose a destination outside the platform checkout so the two repositories remain independent.

## Generate the repository

From the platform root:

    npm run customer:new -- \
      --customer acme \
      --name "ACME Commerce" \
      --env production,staging \
      --dest ../acme-lumi

Rules:

- customer is lowercase and may contain letters, digits, and hyphens.
- production is required. staging and preview are optional.
- dest must be empty or absent; the generator will not overwrite a non-empty directory.
- Each environment receives a distinct Worker name, hostname, Access audience, serving D1 identity, sources bucket, and deployment ID.

The generated repository contains:

    acme-lumi/
      apps/web/                  # React/Vite customer application
      apps/worker/               # customer Worker entrypoint
      customer/                  # customer-owned pages, metrics, adapters, workflows
      customer/migrations/       # additive customer-owned migrations
      infra/environments/        # non-secret per-environment inventories
      vendor/                    # exact packaged core tarballs and manifest
      lumi.lock.json             # customer-level core provenance

## Install and validate

    cd ../acme-lumi
    npm ci --ignore-scripts
    npm run validate
    npm test
    npm run typecheck
    npm run build

validate checks customer identity, reserved routes, module/extension compatibility, environment distinctness, deployment configuration, and migration baselines. build runs validation, typechecking, and the Vite production build.

## Customize safely

Edit customer-owned files only:

- customer/manifest.ts — identity, enabled modules, namespace, branding
- customer/ui/ — real React pages and theme overrides
- customer/data/metrics.ts and customer/data/server-metrics.ts — namespaced executable metrics
- customer/data/connectors.ts — reviewed server-side authorized-export adapters
- customer/workflows/decisions.ts — advisory rules; never external side effects
- customer/ai/ — bounded context/prompts; never authority or credentials

Do not edit node_modules/@runlumi/* or copy platform internals into the customer repository. Do not add arbitrary SQL, eval, remote modules, or browser-executed model code.

## Initialize the independent Git repository

The generator does not create a remote repository. After reviewing the generated files:

    git init -b main
    git add -A
    git commit -m "chore: initialize ACME Lumi application"
    git remote add origin <customer-repository-url>
    git push -u origin main

Use the customer repository’s normal branch protection and review process. Keep customer branding, report TSX, mappings, tests, and workflow rules in that repository; keep reusable platform changes upstream.
