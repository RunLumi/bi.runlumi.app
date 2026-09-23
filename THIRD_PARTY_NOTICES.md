# Third-party provenance and dependency admission

Original Lumi BI software and documentation now use Elastic-2.0 under LICENSE;
see [license scope](LICENSING.md). This owner-authorized change does not relicense
any third-party material. Source visibility and code license are separate from
customer-data confidentiality. Base UI, `cn`, and shadcn tooling use exact versions
in the package locks; this migration does not relicense third-party material.
Builds retain the existing third-party notices and add `LICENSE.txt`/`NOTICE.txt`
for the original product. The independently locked Astro `web/` site also retains
its actual Geist/Geist Mono OFL and adapted Tabler MIT notices.

## Server

API/control Worker code uses Web APIs and Cloudflare bindings, with no runtime
npm dependencies. TypeScript 5.8.3 (Apache-2.0) remains the only root development
dependency. Node built-in SQLite is the local test adapter, not production D1.

## Frontend

Exact direct/transitive versions and integrity digests are in
`apps/web/package-lock.json`. The existing React/Vite graph remains locked with
the Base UI migration packages called out below.

Runtime families: React/React DOM, React Router, TanStack Query, Base UI,
`cn`, and Tabler icons (MIT); class-variance-authority (Apache-2.0); Geist
font asset (OFL-1.1). Owned UI primitives carry the existing shadcn MIT
notice. Build output includes full runtime notices via `scripts/web-notices.mjs`.

Build-only exceptions are narrow: caniuse-lite browser data (CC-BY-4.0), and
unmodified lightningcss plus platform binaries (MPL-2.0). They are build tooling,
not additions to the server Worker or bundled runtime libraries. The admission
script restricts these exceptions to those package names and dev-only placement.
Any change of license, placement, vendoring or distribution requires re-review.

The shadcn CLI is authoring/build tooling (MIT). Its locked dev-only graph includes
`argparse@2.0.1` under the Python Software Foundation / BeOpen Python 2.0 license,
plus `isexe@3.1.5` and `minimatch@10.2.6` under the [Blue Oak Model License 1.0.0](https://blueoakcouncil.org/license/1.0.0).
Repository admission is limited to those exact versions, licenses, and dev-only
placement; these tools are not part of the application runtime or shipped bundle.

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
