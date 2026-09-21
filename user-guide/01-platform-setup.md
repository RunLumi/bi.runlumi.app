# 1. Platform setup

Run these steps from a clean checkout of lumi-bi.

## Prerequisites

- Node.js 22.16.0 (see .nvmrc)
- npm
- Git
- Access to the Lumi BI repository and permission to create a separate customer repository
- For deployment only: reviewed Cloudflare account/resource access, Access configuration, and secrets

Do not put provider credentials, Access tokens, customer data, or unreviewed deployment secrets in Git.

## Install and verify the platform

    npm run setup
    npm run check
    npm run check:commerce
    npm run check:web-deps

npm run setup installs the root and frontend lockfiles with lifecycle scripts disabled. If the environment has no registry access, use an already prepared dependency cache; do not replace the lockfile casually.

## Package the exact core release

The customer generator requires local packaged artifacts:

    npm run core:pack

This builds packages/core, packages/cloudflare, and packages/ui, writes deterministic tarballs under artifacts/core/, and records provenance in lumi-core-manifest.json. It refuses a dirty Git tree by default. Commit reviewed platform changes before packaging.

Verify the package and repository boundaries:

    npm run check:boundaries
    npm run check:licensing
    npm run check:workerd

These commands prove the local platform package graph and repository contracts. They do not prove a live ecommerce provider, merchant-approved source coverage, authenticated Cloudflare staging, or production behavior.
