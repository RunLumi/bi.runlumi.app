# Usage policy: internal work, services and redistribution

This is explanatory guidance, not additional license text, a signed commercial
agreement, or a blanket legal determination for every deployment. [LICENSE](../../LICENSE)
controls covered product use; [LICENSING.md](../../LICENSING.md) identifies scope.

| Scenario | Guidance |
| --- | --- |
| A merchant self-hosts Lumi BI for its own staff | Permitted under ELv2 subject to its conditions; no Lumi cloud service, support or premium entitlement is included |
| A merchant privately customizes dashboards, mappings or its internal application | Permitted subject to ELv2; no general obligation to publish the modifications |
| A contractor charges to install/customize it for a client's internal operation | Permitted when this is not providing a restricted hosted/managed service |
| A contractor continues operating the BI UI/API for clients | Assess what clients access; substantial functionality as a service requires additional rights |
| A company sells a rebranded hosted BI product exposing substantial Lumi functionality | Not permitted by ELv2 alone; negotiate a commercial grant before offering it |
| A company redistributes a self-managed application containing Lumi BI | Distribution is allowed subject to ELv2 and retained notices; charging or competition alone is not a prohibition |
| A service uses Lumi internally and only supplies limited outputs | Fact-specific; not every use inside SaaS is forbidden. Review actual user access/functionality, including combined views |
| An application shows read-only embedded dashboards to third parties | Read-only is not a safe harbor. Review whether the service exposes a substantial feature set |
| A customer changes product branding | Preserve required licensing/copyright/other notices and respect applicable trademark rights; discuss any removal or special white-label rights |
| Someone disables protected license-key functionality | Not permitted under ELv2 |

## Customer-repository practice

Keep customer business data, credentials and confidential configuration out of
public repositories. A customer-specific repo is not a new license for copied
core files. Record core version, source commit, applicable terms, original
notices and prominent modification notices alongside the deployment artifact.
Code authored independently by the customer is not assigned to Lumi by this
policy; derivative/core copies retain their applicable obligations.

No blanket requirement to pay for all business use or share every private change
is added here. Future Apache-licensed scaffolding does not waive the core license.

## Questions needing a specific decision

For hosted resale, OEM embedding or notice-removal requests, send the proposed
operator, users, access surface, copied components, branding, customer ownership
and cloud deployment model to **hello@runlumi.app**. Do not email customer datasets
or secrets. A commercial grant requires an actual agreement with an authorized
rights holder, not an unanswered inquiry or a published roadmap.

Source: [ELv2 text](https://www.elastic.co/licensing/elastic-license) and
[Elastic's FAQ](https://www.elastic.co/licensing/elastic-license/faq), reviewed
2026-09-20. The examples apply the standard restrictions to Lumi's intended model;
a legal review may be needed for a particular deployment.
