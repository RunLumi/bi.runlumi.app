# Third-party provenance and dependency admission

Original Lumi BI code remains private/reserved under LICENSE. No repository
visibility or license changes are made by PR #2. Source visibility and code
license are separate from customer-data confidentiality.

## Server

API/control Worker code uses Web APIs and Cloudflare bindings, with no runtime
npm dependencies. TypeScript 5.8.3 (Apache-2.0) remains the only root development
dependency. Node built-in SQLite is the local test adapter, not production D1.

## Frontend

Exact direct/transitive versions and integrity digests are in
`apps/web/package-lock.json`. No new versions are chosen by the review upgrade.
The existing reviewed React/Vite graph is captured from secret-free CI and locked.

Runtime families: React/React DOM, React Router, TanStack Query, Radix slot/refs,
Tabler icons, clsx, tailwind-merge (MIT); class-variance-authority (Apache-2.0);
Geist font asset (OFL-1.1). Owned UI primitives carry the existing shadcn MIT
notice. Build output includes full runtime notices via `scripts/web-notices.mjs`.
Radix compose-refs omits a LICENSE in its package; the shared radix-ui/primitives
WorkOS notice is read from the pinned sibling react-slot package.

Build-only exceptions are narrow: caniuse-lite browser data (CC-BY-4.0), and
unmodified lightningcss plus platform binaries (MPL-2.0). They are build tooling,
not additions to the server Worker or bundled runtime libraries. The admission
script restricts these exceptions to those package names and dev-only placement.
Any change of license, placement, vendoring or distribution requires re-review.

`check:web-deps` enforces exact direct versions, registry URLs, SHA-512 integrity
and known licenses across the committed graph. CI uses `npm ci --ignore-scripts`,
blocks high/critical advisories and fails on audit-service errors. This is an
engineering admission gate, not a warranty that dependencies are defect-free.

GitHub Actions remain commit-SHA pinned. No action receives deployment credentials
or a write token in the final verification workflow. Release integrity hashes are
produced as CI artifacts; legacy SOURCE_CHECKSUMS.sha256 describes only the original
bootstrap archive, not the current release.

## Future admission

Prefer a maintained permissive component when it materially reduces cost or risk.
Review actual software, bundled assets/models/binaries, services and source licenses
separately. No generic waiver for unknown/copyleft/noncommercial code. Do not change
Lumi's own license merely because a dependency has MIT or Apache terms.
