# Landing dependency and distribution boundary

Original Lumi code remains under the repository's reserved license. This file does
not change the repository license or grant rights to brand assets.

Direct dependencies, reviewed 2026-09-20:

| Package | Version | Purpose | Upstream license |
|---|---|---|---|
| astro | 7.3.3 | Static compiler and local preview | MIT |
| @fontsource-variable/geist | 5.3.0 | Local Geist with native Vietnamese | SIL OFL 1.1 font |
| @astrojs/check | 0.9.10 | Astro typechecking, build-time only | MIT |
| @playwright/test | 1.62.1 | Test runner, not public runtime | Apache-2.0 |
| @types/node | 22.18.6 | Development types | MIT |
| typescript | 5.8.3 | Static checking | Apache-2.0 |

Geist 5.3.0 was published 2026-07-19. Its admission changes only the font package
and root dependency metadata, not the rest of the resolved dependency graph.
All admitted registry packages have integrity values in package-lock.json.

The lock is an exact registry/integrity graph, not a promise that a future advisory
cannot affect a version. Keep the high/critical audit gate enabled. Install with
lifecycle scripts disabled and review dependency diffs explicitly.

The build graph is **not MIT-only**: it includes Lightning CSS (MPL-2.0), optional
libvips image binaries (LGPL-3.0-or-later), and additional permissive/data licenses.
These are build-side tools, not copied into the static distribution. Do not start
redistributing node_modules, native binaries or a bundled build service without
reviewing that changed distribution boundary and its notices.

The website ships Lumi HTML, CSS, vanilla JS, SVGs and local Geist WOFF2 assets, not
Astro or test-runner code as a browser framework. `npm run build` copies the actual
installed Geist OFL notice to `dist/THIRD_PARTY_NOTICES.txt`; retain it in every
deployment. No third-party customer logos, stock photographs or icon package is
redistributed. Branding SVG geometry comes from this repository's original assets.
