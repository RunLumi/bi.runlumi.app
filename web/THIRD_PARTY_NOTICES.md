# Landing dependency and distribution boundary

Original Lumi code remains under the repository's reserved license. This file does
not change the license of the repository or grant rights to brand assets.

Direct dependencies, reviewed 2026-09-20:

| Package | Version | Purpose | Upstream license |
|---|---|---|---|
| astro | 7.3.3 | Static site compiler and local preview | MIT |
| @fontsource-variable/geist | 5.2.6 | Locally hosted Geist, including Vietnamese | SIL OFL 1.1 font |
| @astrojs/check | 0.9.10 | Astro typechecking, build-time only | MIT |
| @playwright/test | 1.62.1 | Test runner, not public runtime | Apache-2.0 |
| @types/node | 22.18.6 | Development types | MIT |
| typescript | 5.8.3 | Static checking | Apache-2.0 |

The package-lock is the exact registry/integrity graph, not a promise that a future
advisory cannot affect a version. CI's high/critical advisory gate must remain on.
Install with lifecycle scripts disabled. Review lock changes rather than accepting
an unrelated major upgrade to make a build green.

Astro and testing dependencies are not shipped as a browser framework. The static
site ships Lumi HTML, CSS, small vanilla JS, brand SVGs and Geist WOFF2 assets.
`npm run build` copies the actual installed Geist license text to
`dist/THIRD_PARTY_NOTICES.txt`. Do not strip it from a deployment. Transitive
build-tool packages retain their upstream licenses and must be reviewed on update.
No third-party customer logos, stock photos or icon package is redistributed.
