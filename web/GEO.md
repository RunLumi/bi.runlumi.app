# Public-site discoverability contract

Reviewed 2026-09-20. Applies only to the Astro marketing site in `web/`.

## Evidence and scope

The supplied NsLookup report for `about.bi.runlumi.app` recorded **59/100**:
technical 31/40, entity 9/30, answer 19/30. It reported no llms.txt, Organization
schema, JSON-LD types or author signals. Its question count is a heuristic: this
site renders **seven reviewed FAQ answers**, after the concurrent landing update, not thirteen invented answers.

The root README already separates the landing page (`https://about.bi.runlumi.app`)
from the platform (`https://bi.runlumi.app`). The old Astro config, metadata and
crawl endpoints incorrectly pointed at the platform. `src/data/site.ts` now owns
the public identity for every generated representation; `appOrigin` explicitly
identifies the separate application. No DNS, app routes or tenant code changes.

## What is emitted

| Surface | Contract |
| --- | --- |
| Homepage HTML | One JSON-LD graph: Organization, WebSite, and a WebPage also typed FAQPage. |
| Privacy HTML | The same publisher identity and its own WebPage; no unrelated FAQ markup. |
| 404 HTML | `noindex, follow`; no structured-data graph. |
| Author | Visible Lumi BI organization byline and editorial review date, matching metadata. |
| Brand | Existing public logo, name, email and absolute URLs; no invented legal details, social profiles, credentials, ratings or prices. |
| `/llms.txt` | Static UTF-8 Markdown summary generated from the same seven answers, including all capability limits, and checked public links. |
| Discovery | HTML `rel="describedby"` link and visible footer link to llms.txt. |
| Canonicals / OG / sitemap / robots | Marketing URLs use the landing origin, never the platform or a preview hostname. |

The wildcard crawler policy is unchanged. Publishing this summary does not grant
access to private applications or change training permissions, licenses, auth or
Cloudflare bot/WAF policies. No secret, customer data or internal endpoint is
included. `llms.txt` is an informational file, not an authorization mechanism.

## Security and regression gates

`serializeJsonLd` escapes HTML delimiters, ampersands and Unicode line separators
before Astro `set:html`; raw `JSON.stringify` is not sufficient protection against
an embedded `</script>` sequence. CSP remains `script-src 'self'` without inline
or eval exceptions. The verifier accepts only parsed JSON-LD data and the existing
external enhancement script, rejecting other inline script types and bodies.

`npm run build` invokes `scripts/verify-geo.mjs` for every built HTML page. It checks
entity identity and references, canonical consistency, exact FAQ source parity,
404/noindex behavior, public logo existence, configured-contact parity, generated llms parity, linked routes
and fragment IDs, robots and sitemap. Existing JS budget, no-tracking, no-hydration,
security and distribution-notice checks remain in place.

`tests/geo.spec.ts` additionally checks raw HTML without relying on hydration,
actual FAQ disclosures, author/date visibility, no-JavaScript access, private-app
canonical rejection, script-breakout serialization, real 404 behavior, content
MIME type and that executable inline JS is still blocked under the test CSP.
The original responsive, accessibility, keyboard and screenshot suite is retained.

## Deployment acceptance

Use Node **24.21.0**, matching `.nvmrc` and the committed package requirements.
Cloudflare Pages root: `web`; build: `npm run build`; output: `dist`. Attach the
custom domain `about.bi.runlumi.app` to this project; do not redirect the BI app to
marketing. DNS/project configuration changes require a separate owner action.

After the merged commit deploys, verify the production response rather than a
cached checker result:

```sh
curl -fsS https://about.bi.runlumi.app/llms.txt
curl -fsS https://about.bi.runlumi.app/robots.txt
curl -fsS https://about.bi.runlumi.app/sitemap.xml
curl -fsSI https://about.bi.runlumi.app/llms.txt
```

Check homepage JSON-LD in raw HTML, the public canonical and social-image URLs,
noindex on Pages previews, a true HTTP 404 and unchanged security headers. Then
rerun the original checker on **about.bi.runlumi.app**, recording the deployment
commit, time and report. A merged PR or passing local/CI test is not proof of
production propagation, a new GEO score, search indexing or AI citations.

## External guidance and limits

Primary references checked 2026-09-20:
- Astro `set:html` and JSON-LD: https://docs.astro.build/en/reference/directives-reference/#sethtml
- Schema.org FAQPage vocabulary: https://schema.org/FAQPage
- llms.txt proposal v2, modified 2026-08-10: https://llmstxt.org/
- Google AI features: https://developers.google.com/search/docs/appearance/ai-features
- Google documentation updates: https://developers.google.com/search/updates

`llms.txt` is a proposal for clients that choose to consume it, not a Google Search
ranking requirement. Google's 2026-06-15 guidance says it has no positive or negative
Search ranking effect. Google also retired FAQ rich results starting 2026-05-07;
FAQPage remains valid Schema.org vocabulary for the FAQ actually present here,
not a promise of rich results. The checker score is a diagnostic, not an estimate
of traffic, indexing, recommendation probability or business performance.
