# Validation: commerce foundation and increments 01–03

Date: 2026-09-20.

## Local executed evidence

- Strict backend TypeScript, the current host Node runtime (repository target remains
  Node 22.16.0) and **240 Node/SQLite/WebCrypto tests**, none skipped.
- Existing tenant/auth/license/pack/query invariants remain covered.
- Raw integrity, strict source/tax contracts, normalizer quarantine, exact money,
  source identity/authority, independent declared controls, atomic publication,
  retained history, source revocation, positive decision outcomes and private exports.
- Durable normalization-job admission, concurrent-cap fencing, idempotent replay,
  owner/resource denial, lease contention, retry exhaustion and source revocation
  after admission.
- Frontend strict TypeScript, Vite production build and runtime notices pass.
- Both dependency graphs unchanged; 173-package frontend lock/provenance checks pass.
- Commerce specs: 28 files, 334 IDs, 50 links, 16 independent reference cases and
  23 deliberately rejected self-tests. Spec oracles alone are not runtime proof.

## Browser and clean-install evidence

The suite contains **17 Playwright tests**: 11 retained regressions and six new
commerce workflow/viewport/failure tests. Test listing is not execution success.

Local managed Chromium refuses loopback HTTP with
`ERR_BLOCKED_BY_ADMINISTRATOR`; no browser restriction was bypassed and no local
browser pass is claimed. Merge requires the final-head remote `verify` workflow
to pass clean installation, blocking dependency advisory checks, production build,
and all browser tests. It retains screenshots, test context, tracked-source archive,
revision and asset hashes. Read the PR verification record for the exact passing SHA.

## Not certified

No Cloudflare deployment, live Access/D1/R2/workerd validation, deployed Queue/DLQ
consumer, load/restore/cutover, source-complete merchant reconciliation, live vendor
API or LLM call. The job boundary is a manual/local consumer, not Queue or outage
recovery evidence. No inference billing, bank ledger certification, third-party
action or autonomous write occurs.

A fixture, declared independent control, checksum or operator-supplied commit is
not merchant verification, independent attestation or production certification.
See [implementation coverage](docs/implementation/README.md) for all remaining domains.
