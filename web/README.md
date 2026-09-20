# Lumi BI public landing page

A Vietnamese, editorial Astro site for **https://bi.runlumi.app**. This independent
`web/` project does not replace or import the authenticated app in `apps/web/`.

## Run and verify

Node **22.16.0**, npm **10.9.2**. The committed dependency graph is installed without
package lifecycle scripts:

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

Astro statically renders the landing, privacy and 404 pages. `dist/` contains the
entire website. It requires no React hydration, SSR adapter, Worker function,
D1 database, API binding, customer data or runtime secret.

## Cloudflare Pages: Git integration

Create a **Pages** project connected to this repository, separately from the BI
application deployment. Review the preview URL before assigning the public domain.

| Setting | Value |
|---|---|
| Project name | `lumi-bi-web` |
| Production branch | `main` |
| Root directory | `web` |
| Framework | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version / `NODE_VERSION` | `22.16.0` |
| `PUBLIC_CONTACT_EMAIL` | Confirmed public mailbox; default `hello@runlumi.app` |
| Custom domain | `bi.runlumi.app` |

The `.nvmrc` and independent package-lock prevent selecting the application's
package graph. Pages may perform its automatic dependency install before the
build; `.npmrc` disables dependency lifecycle scripts. Do not set the root directory
to `apps/web`, and do not use the repository's application build command here.
`wrangler.jsonc` declares Pages output only; the dashboard Git build does not need
Wrangler installed. This PR does not create a Cloudflare account, project, DNS
record or deployment. Do not point the domain at a guessed `pages.dev` hostname.

After a successful Pages preview, open **Custom domains → Set up a custom domain**,
add `bi.runlumi.app`, and follow Cloudflare's actual DNS instructions. Confirm the
HTTPS certificate and domain status. Production branding, canonical URL, robots
and sitemap target the custom domain; keep preview deployments non-indexable
using Pages' preview behavior and verify the response before publishing.

Official references checked 2026-09-20:
- https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/
- https://developers.cloudflare.com/pages/configuration/monorepos/
- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://developers.cloudflare.com/pages/configuration/headers/

### Launch acceptance, not assumptions

1. Confirm `PUBLIC_CONTACT_EMAIL` is monitored. Open the mailto CTA on desktop and
   a phone, send a test message yourself, and verify receipt. There is no backend
   lead form and the website does not claim that an email was sent.
2. Verify `/`, `/privacy/`, `/robots.txt`, `/sitemap.xml`, and an unknown URL's
   actual **404** response on Pages. Check canonical, favicon and local fonts.
3. Verify `_headers` on Pages: strict CSP, `nosniff`, frame denial and immutable
   caching for hashed `_astro` assets. The local Astro preview does not emulate
   Pages header application; no production security certification is claimed.
4. Verify desktop, phone, keyboard tabs/details/menu, 200% text and reduced motion.
   No horizontal page overflow, missing Vietnamese glyphs or clipped controls.
5. Verify previews are not indexed, all anchors resolve and the domain is HTTPS.
   Keep the public site separate from any tenant-facing application hostname.
6. Recheck copy against shipped capabilities. Do not remove preview/roadmap labels
   until the corresponding feature has evidence of delivery.

Rollback uses the prior successful Pages deployment. No schema or data migration
is involved. Any new form, analytics or embedded service requires revisiting the
privacy page, content security policy and explicit submission states.

## Content and structure

```
src/components/       Brand and interactive synthetic product preview
src/data/             Public site settings and independently tested sample math
src/layouts/          Shared semantic page, navigation, SEO and footer
src/pages/            Home, privacy, 404, robots and sitemap
src/styles/           Exact brand tokens and responsive editorial presentation
public/site.js        Small progressive enhancement, no network/data collection
public/brand/         Canonical-color variants of the repository's logo geometry
public/_headers       Static Pages security and asset cache policy
scripts/              Built-artifact acceptance checks and distribution notices
tests/                Arithmetic, mobile/desktop, keyboard and no-JS coverage
```

The central fixture reconciles 1,280 million VND gross minus 80 million returns
to 1,200 million net revenue. Disclosed variable costs total 972 million, leaving
228 million contribution (19%), **not net profit or cash received**. Stock cover
is explicitly an estimate and missing incoming stock is never represented as 0.
No sample on this site is a customer result or a working connector demonstration.

### Design adoption and known drift

`DESIGN.md` governs warm paper `#F4F0E8`, navy `#102A43`, blue `#006093`, Geist,
8px controls/cards and restrained editorial material. Fontsource names its family
`Geist Variable`; that name is used first in the same-family fallback stack.
Vietnamese font assets are locally bundled by the Fontsource import.

The repository's legacy brand SVG contains older cyan/blue values and a padded
artboard. The landing variant keeps the original folded-L and upright outlined
wordmark paths, crops empty artboard space and applies the canonical monochrome
Lumi Blue. Source assets are left unchanged; this is not a logo redesign.

The guide's companion paths and CEO-workspace examples are not imported as product
capabilities. This page uses the current commerce strategy and explicitly labels
Nhanh.vn, Shopee, Haravan and Ask Lumi as roadmap work. Existing `apps/web` style
exceptions do not authorize new palette or typography drift here.

## Dependency and validation evidence

See `THIRD_PARTY_NOTICES.md`. Original code remains reserved under the repository
license. CI installs the lock, checks Astro and fixture math, audits dependencies,
builds output, checks static contracts and exercises Chromium desktop/mobile.
Screenshots, test traces, audit JSON, lock hashes and the tested source revision
are retained as `landing-evidence`. Browser tests are not a WCAG certification,
merchant data verification, live API test or proof of a deployed Pages domain.
