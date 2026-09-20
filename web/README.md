# Lumi BI public landing page

Vietnamese editorial Astro site for **https://bi.runlumi.app**. This independent
`web/` project neither replaces nor imports the React BI application in `apps/web/`.

## Run and verify

Use Node **22.23.2** from `.nvmrc` and its bundled npm. The landing's admitted graph
requires Node >=22.19.0 because of a transitive build dependency. The root
application's Node pin is deliberately unchanged.

```sh
cd web
npm ci --ignore-scripts
npm run dev
# http://127.0.0.1:4321
npm run check
npm run build
npx --no-install playwright install chromium
npm run test:e2e
```

Astro renders static HTML, CSS and a small progressive-enhancement script to
`dist/`. No React hydration, SSR adapter, Worker function, D1 database, API binding,
customer data or runtime secret is needed. Dependency lifecycle scripts are off.

## Deploy to Cloudflare Pages

Create a **Pages** project connected to this repository, separate from the BI
application. Review its preview URL before assigning the public domain.

| Setting | Value |
|---|---|
| Project name | `lumi-bi-web` |
| Production branch | `main` |
| Root directory | `web` |
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version / `NODE_VERSION` | `22.23.2` |
| `PUBLIC_CONTACT_EMAIL` | Confirmed public mailbox; default `hello@runlumi.app` |
| Custom domain | `bi.runlumi.app` |

Pages performs its dependency install before the build; `.npmrc` disables lifecycle
scripts and the committed lock identifies the graph. Do not select `apps/web` or
the root application build command. `wrangler.jsonc` declares Pages output, but the
dashboard Git build does not require Wrangler installed.

This PR does **not** create a Cloudflare project, deployment, DNS record or TLS
certificate. After a successful Pages preview, use **Custom domains → Set up a
custom domain**, add `bi.runlumi.app`, and follow the actual DNS instructions.
Do not point DNS at a guessed `pages.dev` address. Keep any tenant-facing app on a
separate hostname.

Official setup references, checked 2026-09-20:
- https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/
- https://developers.cloudflare.com/pages/configuration/monorepos/
- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://developers.cloudflare.com/pages/configuration/headers/

### Production acceptance

1. Confirm `PUBLIC_CONTACT_EMAIL` is monitored. Open the CTA on desktop and a phone;
   send a test message yourself and verify receipt. The website opens email and
   does not automatically submit, store or claim a successful registration.
2. Verify `/`, `/privacy/`, `/robots.txt`, `/sitemap.xml`, local fonts and favicon.
   An unknown URL should return a real **404**, not an application SPA fallback.
3. Verify Pages applies `_headers`: strict CSP, `nosniff`, frame denial, and long
   cache only for hashed `_astro` files. CI tests the same policy through a browser
   response override; that is not evidence that a live domain serves those headers.
4. Inspect desktop and phone, keyboard tabs/menu/details, 200% text, reduced motion
   and Vietnamese glyphs. Check every CTA and the final canonical domain.
5. Verify preview deployments are not indexed, then confirm the custom domain's
   HTTPS certificate. The production robots and sitemap target `bi.runlumi.app`.
6. Recheck copy against actual delivered capabilities before removing any preview
   or roadmap label.

Rollback selects the previous successful Pages deployment. No database migration
is involved. A future form, analytics or embedded service requires revisiting the
privacy page, CSP and explicit submission states before release.

## Structure

```
src/components/       Brand and synthetic product preview
src/data/             Contact settings and tested sample calculations
src/layouts/          Semantic document, navigation, SEO and footer
src/pages/            Home, privacy, 404, robots and sitemap
src/styles/           Exact tokens, editorial presentation and legibility fixes
public/site.js        Keyboard tabs, mobile menu and copy-email enhancement
public/brand/         Canonical-color copies of existing logo geometry
public/_headers       Pages security and static caching
scripts/              Built-output checks and font notices
 tests/               Arithmetic, browser behavior, glyphs, reflow and CSP
```

All three preview views are synthetic. Gross 1,280 million VND minus 80 million
returns gives 1,200 million net revenue. Disclosed variable costs total 972 million,
leaving 228 million contribution (19%), **not net profit or money received**.
Stock cover is an estimate; missing incoming stock is never represented as zero.
No sample is a customer result, live API connection or autonomous action.

## DESIGN.md adoption and drift review

Warm paper `#F4F0E8`, navy `#102A43`, blue `#006093`, Geist, restrained depth and
8px controls/cards follow the guide. Fontsource's CSS family name is `Geist
Variable`, the same Geist face, not an added brand typeface.

**Vietnamese is verified, not inferred from successful font loading.** The older
5.2.6 font files lacked important Vietnamese glyphs. The landing pins Fontsource
Geist **5.3.0**, published 2026-07-19, with a declared Vietnamese subset. Build checks
require the local subset and browser tests inspect the actual platform font used
for the Vietnamese alphabet, not merely `document.fonts.check`.

The legacy repository SVG has older blue/cyan fills and a padded artboard. The
landing variant retains the original folded-L and outlined wordmark paths, crops
empty space and applies canonical monochrome Lumi Blue. The original asset is
unchanged. This is a documented palette correction, not a new logo.

The guide's older companion paths and CEO-workspace examples are not capabilities
to advertise. Product copy follows the current commerce README: Nhanh.vn, Shopee,
Haravan and Ask Lumi remain roadmap work. Source provenance and unknown states
are visible, without inventing testimonials, customer logos, ROI, prices or dates.

## Evidence and licensing

CI uses read-only repository permissions and an exact `npm ci` graph. It runs
Astro checks, sample-math tests, dependency audit, static-output contracts and
Chromium desktop/mobile tests. The `landing-evidence` artifact records source and
lock hashes, screenshots, audit JSON, reports and failure traces. The temporary
lock-admission workflow is removed from the final tree; CI never writes branches.

See `THIRD_PARTY_NOTICES.md`. Original code remains reserved. The build copies the
installed font's actual OFL text into `dist/THIRD_PARTY_NOTICES.txt`.
Test results are not a WCAG certification, real merchant reconciliation, live
Cloudflare deployment, email-delivery test or security certification.
