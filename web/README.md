# Lumi BI — public marketing site

Vietnamese Astro landing for **https://bi.runlumi.app**, independent from the
React tenant application in `../apps/web`. Separate package and lock, static
output, no auth, tenant bindings, API calls, tracking or customer data.

## Develop and verify

Use **Node 24.21.0** from `web/.nvmrc`. Root/application runtime pins are unchanged.

```sh
cd web
npm ci --ignore-scripts
npm run dev
npm run check
npm run build
npx --no-install playwright install chromium
npm run test:e2e
```

`check` runs Astro/TypeScript, JavaScript syntax and independent fixture tests.
`build` emits HTML/CSS/local fonts and verifies routes, canonical URL, CSP
constraints, JavaScript budget, image dimensions and distribution notices.
Browser tests use the built site with common security headers, not Astro's dev
server. Set `CHROMIUM_EXECUTABLE_PATH` only for an intentional system-browser run;
CI installs the browser belonging to the locked Playwright version.

No React hydration, chart library or AI SDK reaches the browser. With JavaScript
disabled, all scenarios remain visible; native FAQ/evidence disclosures and
contact links remain usable. Clicked tabs are shareable; keyboard orientation
matches the phone/desktop column and tablet row.

## Deploy with Cloudflare Pages Git integration

Create a separate **Pages** project, not another tenant Worker.

| Setting | Value |
| --- | --- |
| Repository | `RunLumi/lumi-bi` |
| Suggested project name | `lumi-bi-web` |
| Production branch | `main` |
| Root directory | `web` |
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node / `NODE_VERSION` | `24.21.0` |
| `PUBLIC_CONTACT_EMAIL` | Monitored public mailbox; default `hello@runlumi.app` |
| Custom domain | `bi.runlumi.app` |

Output is `dist`, **not `web/dist` when root is already `web`**. `.npmrc` disables
dependency lifecycle scripts. `wrangler.toml` declares the same static output;
no SSR adapter, Functions, D1, R2, API key or runtime secret is needed.

Review the assigned preview before adding `bi.runlumi.app` in **Pages → Custom
domains**. Follow the account's actual DNS instructions; do not guess a Pages
hostname or overwrite an existing route without checking it. Repository changes
alone do **not** create a Cloudflare project, deployment, DNS record or TLS cert.

### Production acceptance

1. Confirm the mailbox is monitored and send a real test message from desktop and
   mobile. The CTA only opens an editable email; the website never submits it or
   invents a successful registration. Invalid mailbox configuration fails build.
2. Check `/`, `/quyen-rieng-tu/`, `/robots.txt`, `/sitemap.xml`, fonts, favicon and
   social card. `/privacy` and `/privacy/` must redirect to the Vietnamese route.
   Unknown URLs must return an actual 404, not an application SPA fallback.
3. Check live `_headers`: strict CSP without `unsafe-inline` or `unsafe-eval`,
   frame denial, `nosniff`, and immutable cache only for hashed assets. Verify
   `*.pages.dev` hosts have `X-Robots-Tag: noindex, nofollow` and public TLS works.
4. Inspect desktop, phone, keyboard, 200% text, reduced motion/transparency, and
   Vietnamese glyphs. Confirm copy still matches current product capabilities.

The loopback test server exercises common headers and exact redirect rules,
not all Pages host/cache/edge behavior. Roll back by choosing the previous Pages
deployment; no database migration is involved. A form, tracker or embedded service
would require explicit consent, submission states, privacy and CSP review.

Official references checked 2026-09-20:
- https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/
- https://developers.cloudflare.com/pages/configuration/monorepos/
- https://developers.cloudflare.com/pages/configuration/headers/
- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://docs.astro.build/en/guides/deploy/cloudflare/

## Product and design contracts

Read the root README, AGENTS, DESIGN and ICON documents before changing claims.
The application has a bounded authorized-export commerce workflow, not a
merchant-verified production system. Live Nhanh/Haravan/Shopee connections and
Ask Lumi remain roadmap work. The public demo is a separate synthetic example,
not a connection, customer result or working AI agent.

`src/data/site.ts` owns positioning, contact and roadmap statuses;
`src/data/demo.ts` owns independent scenarios; `Demo.astro` pairs metrics with
sources, definitions and unknowns. `global.css` mirrors DESIGN.md's canonical
palette and material recipes. `public/scripts/site.js` is progressive enhancement.

The warm paper `#F4F0E8`, navy `#102A43`, blue `#006093`, Geist, modest 8px sheets
and controlled elevation follow DESIGN.md. Only the sticky navigation uses a
high-opacity glass-chrome treatment, with an opaque default/reduced-transparency
fallback; charts, evidence and content remain opaque. Text uses relative units
and reflows rather than hiding horizontal overflow.

Main's canonical outlined logo is preserved in `public/brand/`. Geist **5.3.0**
and its exact admitted lock integrity retain the Vietnamese fix from main.
Acceptance inspects the actual font rendering a Vietnamese alphabet using browser
font inspection, not merely a loaded-family check. Geist Mono 5.2.6 is limited to
ASCII dates/digits/edition text. No font binaries are committed outside generated
package-managed output.

Fixture contracts: 512m before returns − 26m returns = **486m VND net revenue**;
all seven daily points sum to that same total. Pending settlement is not received
cash. Missing costs keep contribution unknown. Operations has **57 new** events
but **24 open** at period end. Stale stock is not a forecast or an order approval.
No fabricated testimonials, partner badges, prices, certifications or ROI claims.

## PR #8 reconciliation and evidence

The two-parent merge preserves current main's commerce/application work. The
PR's coherent three-scenario design is retained, alongside main's Vietnamese
font fix, canonical brand assets, `web/AGENTS.md` and public-contact override.
One `landing.yml` replaces conflicting pipelines. Node is consistent across the
manifest, `.nvmrc`, CI and Pages instructions.

The temporary lock reconciliation copied only the already-admitted Geist entry
from immutable main; it is removed before final acceptance. Remaining CI is
read-only: exact `npm ci`, audit, checks, build, browser acceptance, source/lock
hashes, screenshots and test reports. It never deploys or writes branches.

Automated checks cover 1440/1024/768/390/320px, keyboard/deep links, no-JS behavior,
clipboard failure, actual Vietnamese fonts, 200% text, redirects/404/SEO/CSP, no
external requests/storage and axe WCAG rule sets. Results are evidence for that
revision, not full WCAG, security, merchant or production-deployment certification.

## Licensing

The committed lock fixes the complete graph and integrity. Original Lumi code
remains reserved under root LICENSE. Build tools are not browser runtimes. Local
Geist fonts use OFL-1.1; adapted Tabler utility paths use MIT. Build copies their
actual license notices into `dist/THIRD_PARTY_NOTICES.txt`. Root dependencies and
product licensing are unchanged.

The committed 1200×630 social card can be regenerated by a maintainer with the
locked browser using `node scripts/social-card.mjs`; this is not a Pages build
requirement. Review the generated image before committing it.
