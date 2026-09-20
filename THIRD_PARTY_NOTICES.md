# Third-party provenance

No third-party source is vendored. There are no runtime npm dependencies in
this bootstrap. The local harness uses Node.js built-in SQLite; production
uses Worker Web APIs and D1/R2 bindings. Cloudflare products have service terms
separate from an OSS license.

## Build dependency

| Package | Exact version | License | Use |
| --- | --- | --- | --- |
| TypeScript | 5.8.3 | Apache-2.0 | Development typecheck only |

Registry metadata and tarball integrity are locked in `package-lock.json`.
Source: https://registry.npmjs.org/typescript/5.8.3

The CI actions are pinned by full commits; source and licenses are maintained by
`actions/checkout` and `actions/setup-node`. Re-evaluate those pins before a
production release. A pinned commit is reproducibility, not proof of safety.

## Candidates, not installed

React, Hono and a chart library such as Apache ECharts may be evaluated when the
first real dashboard requires them. A candidate is not an approved dependency.
Do not add a full BI server or heavy semantic service just to render the first
three customer dashboards. Compare embed terms before adopting third-party BI.

## Dependency admission

Review exact artifact, transitive dependencies, bundled models/assets/binaries,
license, release age, maintainer changes and security advisories. Prefer a
minimal maintained MIT/Apache/BSD/ISC dependency when it buys meaningful
reliability. Copyleft, source-available, noncommercial, custom model and unknown
licenses require explicit review; they are not all interchangeable or illegal.
Preserve notices when shipping incorporated code. Do not change Lumi's own
license because a dependency is MIT. No automatic merge of updates.
