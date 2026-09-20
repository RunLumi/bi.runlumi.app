# Working with commerce specifications

Read the root AGENTS.md first. This file only governs this specification tree.

Use README.md as the ownership map and manifest.json as the delivery dependency inventory. Each responsibility has one canonical C00–C27 owner. Update that file and its acceptance cases instead of appending contradictory rules to several documents.

The suite is a target, not an implementation report. A source API being documented does not mean Lumi has app approval, correct scopes or a tested adapter. Keep unknowns in research/open-questions.md with an evidence action and a feature gate. Preserve official URLs and review dates; do not insert nonportable chat citation tokens.

For changes to commerce math, add or amend synthetic reference fixtures and explain recognition, time basis, tax/currency, joins, missing data and source coverage. Match implementation PRs to stable requirement/acceptance IDs. A future backend must run the cases through its real compiler/normalizer: passing the independent Python oracle alone is insufficient.

Run `python3 scripts/check-commerce-specs.py --self-test` from repository root and `npm run check` before proposing a specification change. Do not weaken cross-tenant, missing-data, cash-versus-capacity or source-identity tests to make a feature easier to claim.

Do not turn end-state capability lists into launch prerequisites. C27 owns delivery gates. Build one source-to-verified-decision slice first, then earn expansion through merchant usage, reliability and support economics.
