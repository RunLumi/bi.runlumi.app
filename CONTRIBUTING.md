# Contributing to Lumi BI

Read [AGENTS.md](AGENTS.md), [LICENSING.md](LICENSING.md) and the relevant contracts.
Issues, reproducible synthetic cases and focused improvements are welcome. Never
include customer data, credentials, employer-confidential code or unclear copied
material. Report security-sensitive issues via [SECURITY.md](SECURITY.md).

## Contribution rights

Submit original changes under the destination component's stated license unless
separately agreed in writing. Product source currently uses Elastic-2.0; no
original Apache SDK/starter scope has yet been designated. Declare third-party
sources, exact versions and notices, and confirm you have permission from any
employer/customer/other rights holder whose consent is needed.

You retain copyright unless a separate agreement assigns it. A PR, sign-off or
this guide is **not** an automatic copyright assignment or an executed commercial
relicensing grant. ELv2's non-sublicensable grant alone is not enough to assume
Lumi may relicense somebody else's contribution commercially.

Until a reviewed contributor agreement is established, maintainers must hold
outside copyrightable contributions unmerged unless documented rights already
cover both the public license and the intended commercial offering. Obtain a
separate signed permission/CLA where necessary. DCO sign-off can help establish
provenance but does not replace that permission. Automated license checks do not
verify legal identity, employer consent or signed agreements.

Keep agreement records private and record only non-sensitive review references
in PRs. See the [rights checklist](docs/licensing/rights-review.md).

## Engineering acceptance

Use a focused PR describing the customer outcome, affected requirement IDs,
provenance, tests and limitations. Preserve existing notices. For license or
component-boundary changes, include explicit owner approval and update the scope
inventory; do not relicense shared core by copying it into a starter.

Run `npm run check`, `npm run check:commerce`, `npm run check:web-deps` and relevant
build/browser checks. `npm run check:licensing` also runs in the root check. New
code needs meaningful negative authorization and data-correctness tests. Never
weaken a test or remove a notice to make a change pass.
