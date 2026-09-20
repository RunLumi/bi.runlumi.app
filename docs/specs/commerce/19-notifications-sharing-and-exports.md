# C19 — Briefs, collaboration, exports and sharing

Spec: C19 | Status: Target contract | Stage: P0 in-app/email draft, P1 approved delivery, P2 embeds/partner workflows

Owns: information delivery and collaboration lifecycle. C16 owns insight logic; C22 owns access/privacy; C21 owns operational actions.

## Outcome

The right merchant operator receives a small number of relevant, explainable items and can delegate or resolve them. Scheduled messages and shared links must not become a backdoor to private commerce data.

## Contract

- **C19-R01:** scheduled briefs reference approved metrics, source coverage and a pinned evaluation context. An unavailable source yields a health notice, not an AI-written assurance that business is normal.
- **C19-R02:** delivery permissions are evaluated at render and delivery time for the intended recipient. A saved schedule or previously generated PDF does not preserve revoked membership.
- **C19-R03:** every external message has an approved channel/destination policy, dedupe key, rate budget and audit record. Integrating a channel is separate from permission to send.
- **C19-R04:** exported data is reauthorized server-side by row/column/metric scope; arbitrary browser-supplied SQL or 'all columns' cannot expand it.
- **C19-R05:** public links to customer financial/PII datasets are off by default. Signed links have narrow object/scope, expiry and revocation behavior; sensitive downloads are authenticated where prompt revocation is required.

## Delivery surfaces

P0 in-app Today plus user-requested evidence exports. P1 approved email briefs and event-driven notifications with quiet hours/timezone, severity policy, cooldown and batched summaries. Zalo OA or other messaging integration is a separately verified provider/consent/permission capability—not a promise that a personal Zalo number can be automated. SMS/push only when volume, costs and delivery terms are verified.

Brief shape: one-line business context, up to three material items, source/freshness caveat, owner/next step, authenticated evidence link. Do not attach full customer lists or raw order tables just because email supports attachments. A revoked or unavailable channel produces a delivery exception with retry rules.

## Collaboration

Comments, assigned cases, due dates, mentions, annotations and decision rationale are tenant scoped. An agency/partner receives explicit cross-tenant delegation, never data copied into a shared public workspace. Mentions cannot invite an unauthorized person through notifications. Link previews follow the same policy as page access.

## Export contract

Formats: CSV first; XLSX/PDF for presentation after validated generators; API/BI-tool access under C25. Large exports run asynchronously with snapshot ID, exact filters, schema/metric versions, currency/timezone, generation time and data watermark in metadata. CSV/XLSX neutralize formula injection, preserve long IDs/text and exact money. Excel macros are not generated or executed.

Jobs pin data context but recheck authorization before download. Distinguish job expired, access revoked, snapshot deleted and source stale. Exports are stored privately with retention/delete propagation. Cached chart screenshots can leak; include them in deletion/revocation design.

## Embeds and external BI

P2 signed/authenticated embeds carry tenant, role scope and expiry, with CSP/frame allowlist and no editable tenant ID. Partner-hosted dashboards do not bypass Lumi authorization. External BI clients query approved datasets/metrics; raw warehouse access is a separately contracted isolated capability, not a shortcut around the semantic layer.

## Acceptance

- **C19-A01:** revoke membership after report generation but before send/download: sensitive delivery is denied and audit explains why.
- **C19-A02:** repeated scheduled job delivery produces one logical brief, with retries not duplicate messages.
- **C19-A03:** a source outage changes the brief to honest partial/stale state; no fabricated change explanation.
- **C19-A04:** CSV cell starting with spreadsheet formula syntax is exported safely; long IDs remain exact.
- **C19-A05:** expired/forged embed or export token cannot query another tenant or expand row scope.
- **C19-A06:** mention to an unauthorized address cannot leak case amount/customer details.
- **C19-A07:** quiet hours, locale and configured merchant timezone are respected; provider acceptance and recipient delivery are separate states.
