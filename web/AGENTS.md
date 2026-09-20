# Public landing page

This directory is the Astro static marketing site for `https://bi.runlumi.app`,
not the authenticated React BI application in `apps/web`. Root AGENTS.md and
DESIGN.md remain authoritative. Do not couple this build to the control plane,
tenant database, application session, or a Cloudflare API token.

Preserve these outcomes:
- An owner understands the money, stock and operations questions, then can open
  an email conversation about a pilot. No fake form, registration or success state.
- All commerce examples are synthetic and labelled. Roadmap connectors and Ask
  Lumi must not become claims of production capability. Read the root README
  before changing product copy. Do not invent testimonials, logos, savings or prices.
- Core content, evidence details, navigation and contact work without JavaScript.
  Enhancements use real keyboard-operable tabs, focus states and reduced motion.
- Warm paper, exact palette, Geist, canonical folded-L geometry and editorial
  whitespace come from DESIGN.md. No decorative AI imagery or dark theme.

`src/data/demo.ts` owns synthetic calculations. Check sums and denominators before
changing a chart. Null, missing, estimated, contribution, profit and actual cash
are different concepts. UI examples are not API integration tests.

Before shipping run `npm ci --ignore-scripts`, `npm run check`, `npm run build`,
and `npm run test:e2e` with the pinned browser installed. Inspect desktop/mobile
screenshots and retain the actual commit/run identity. A passing local preview
is not proof of Pages headers, DNS, email delivery or production accessibility.

Keep the dependency graph locked. No framework hydration, analytics, storage,
external fonts, secrets or API calls without an explicit product requirement and
review of privacy, CSP and performance. Publish font notices in every build.
