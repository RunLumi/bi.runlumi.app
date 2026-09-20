# Lumi BI — public marketing site

Vietnamese Astro landing page for **https://bi.runlumi.app**. Independent from the
React tenant application in `../apps/web`: separate package/lock, static output,
no API calls, no auth, no tenant bindings, no tracking and no customer data.

## Develop and verify

```sh
cd web
npm ci --ignore-scripts
npm run dev
npm run check
npm run build
npx --no-install playwright install chromium
npm run test:e2e
```

Node 22.16.0 is pinned in `.nvmrc`. `npm run build` checks Astro/TypeScript, emits
HTML/CSS/local fonts and verifies routes, SEO, security constraints, JS budget,
image dimensions and distribution notices. Tests use a loopback-only server with
the common production CSP from `_headers`, not Astro's permissive dev server.
Set `CHROMIUM_EXECUTABLE_PATH` only when intentionally testing a system browser.

The browser gets a small vanilla enhancement script, not React, chart libraries
or an AI SDK. With JavaScript disabled, every scenario remains visible, native
FAQ/evidence disclosures work, navigation works and contact remains a mail link.

## Cloudflare Pages — Git integration

Create a **Pages** project, not another tenant Worker:

| Setting | Value |
| --- | --- |
| Repository | `RunLumi/lumi-bi` |
| Suggested project name | `lumi-bi-web` (confirm availability) |
| Production branch | `main`, after this change is reviewed and merged |
| Root directory | `web` |
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION=22.16.0` |

The output is `dist`, **not `web/dist` when the root is already `web`**. No adapter,
SSR, Pages Functions, API keys, D1, R2 or Node compatibility flag is required.
`wrangler.toml` declares the same output for an optional reviewed CLI workflow;
it does not create a project, attach a domain or configure Git integration.

In Pages → Custom domains, add **bi.runlumi.app** to this project first. Follow the
provided DNS instructions; use the actual assigned Pages target, not an assumed
hostname. Check existing records/Worker routes before changing DNS. Confirm the
custom domain and TLS are active and open it from an external browser.

Configure build watch paths to include `/web/*` (and this workflow as needed) so
changes to the tenant app do not rebuild the marketing site. The Pages UI's own
watch-pattern syntax is authoritative; test with a harmless preview commit.
Production Git deployment and custom-domain setup require the account owner.
This repository change does **not** itself deploy or change DNS.

Post-deployment acceptance: verify canonical URL, HTTP 404, headers, local font
loads, keyboard/mobile controls, email recipient, social preview, TLS, and that
`*.pages.dev` previews return the configured `X-Robots-Tag: noindex, nofollow`.
A locally passing test does not prove Cloudflare edge/DNS behavior.

Primary platform references checked 2026-09-20:
- https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/
- https://developers.cloudflare.com/pages/configuration/headers/
- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://docs.astro.build/en/guides/deploy/cloudflare/

## Content and product truth

Read `../README.md`, `../AGENTS.md`, `../DESIGN.md`, `../ICON.md` and the commerce
specifications before changing public claims. As reviewed 2026-09-20, the source
README identifies a foundation preview, **not merchant-verified production**.
Live Nhanh/Haravan/Shopee integration, Ask Lumi and commerce calculations are not
advertised as shipped. Connector names are roadmap targets, not partner badges.

- `src/data/site.ts`: positioning, navigation, contact, connector statuses, FAQ.
- `src/data/demo.ts`: isolated synthetic scenarios and definitions; no API.
- `src/components/Demo.astro`: source, limit and missing-cost evidence adjacent to metrics.
- `src/pages/index.astro`: the edited marketing narrative.
- `src/styles/global.css`: scoped token mirror and responsive layouts.
- `public/scripts/site.js`: accessible progressive enhancement only.
- `public/_headers`: CSP, security/cache headers, noindex on Pages hostnames.

Money example: 512.0m before refunds minus 26.0m refunds = 486.0m VND net revenue.
The seven daily points sum to that same 486.0m. Pending settlement is not cash
received. Missing COGS means unknown contribution margin, never zero. Operations
example: 57 new exceptions during the week differs from 24 still open at period
end. Stock examples are stale snapshots, not forecasts. Scenarios are independent.

Contact is an editable `mailto:` draft to `hello@runlumi.app`, never a silently
sent lead or invented success state. No fake testimonials, customer logos, prices,
certifications, revenue uplift claims or payment capture. Confirm the mailbox
with the owner before marketing launch; production delivery is not tested here.

## Design review notes

Canonical paper `#F4F0E8`, ink `#102A43`, blue `#006093`, Geist/Geist Mono, restrained
sheet elevation, folded-L geometry, one navy editorial insight sheet. Light-only.
The existing app logo has older blue fills; marketing reuses its exact geometry
with the canonical monochrome Lumi Blue. The application is deliberately unchanged.

Fonts are served locally from locked Fontsource packages, with `font-display:swap`.
**Known font boundary:** Geist 5.2.6's shipped subsets lack some Vietnamese codepoints
(e.g. U+1EA5, U+1EC7). The DESIGN.md-approved Noto/system fallback is retained for
those characters, not a claim that Geist provides full Vietnamese coverage. Do not
introduce a different display family or remove accents to hide this limitation.
Review Vietnamese on macOS, iOS, Android and Windows before launch; browser tests
and visual evidence record only the environment actually run. No font binaries
are committed into the repository outside package-managed build output.

SVG charts have named text alternatives and real data tables. Unknown/stale/demo
states use text, not color alone. Native disclosures, visible focus, Escape menu
closing, roving keyboard tabs, copy error handling and reduced motion are tested.
The 320px layout stacks cards; it never clips the page to conceal overflow.

## Supply chain and notices

`package-lock.json` is committed. Lifecycle scripts are disabled. Astro 7.3.3
(MIT), @astrojs/check 0.9.10 (MIT), TypeScript 6.0.3 (Apache-2.0), Playwright 1.62.1
(Apache-2.0), axe Playwright 4.13.0 (MPL-2.0), Fontsource Geist/Geist Mono 5.2.6
(OFL-1.1) were resolved from npm in an isolated feature-branch bootstrap. The
bootstrap reported zero known audit vulnerabilities at that resolution; this is
not a security certification. Full transitive versions/integrity are in the lock.
Geist fonts and adapted MIT Tabler utility paths are the redistributed assets;
`npm run build` writes their notices into `dist/THIRD_PARTY_NOTICES.txt`. Original
Lumi code remains reserved under the root LICENSE. No application dependencies
or product license changed.

To regenerate the committed 1200×630 social image after an intentional copy edit:
install the test browser, then `node scripts/social-card.mjs`. This is a maintainer
operation, not a Pages build requirement. Review the image before committing it.

## Verification scope

CI checks the built site at 1440, 1024, 768, 390 and 320px, records full-page
screenshots, runs axe WCAG rule sets, checks tabs/evidence, mobile menu, deep links,
no-JS fallback, clipboard rejection, metadata/404/privacy and reduced motion.
Artifacts retain source, static output and test evidence. The CI workflow has
read-only repository permission and never deploys. Passing automated checks do
not establish full WCAG conformance, real connector readiness or Cloudflare parity.
