# Validation: commerce foundation and increments 01–03

Date: 2026-09-20.

## Local executed evidence

- Strict backend TypeScript, the current host Node runtime (repository target remains
  Node 22.16.0) and **244 Node/SQLite/WebCrypto tests**, none skipped.
- Existing tenant/auth/license/pack/query invariants remain covered.
- Raw integrity, strict source/tax contracts, normalizer quarantine, exact money,
  source identity/authority, independent declared controls, atomic publication,
  retained history, source revocation, positive decision outcomes and private exports.
- Durable normalization-job admission, concurrent-cap fencing, idempotent replay,
  owner/resource denial, lease contention, retry exhaustion and source revocation
  after admission.
- Canonical tenant lifecycle transitions, strong revision fencing, operator-only
  audit, session/cell access denial for inactive states and deletion fencing without
  false erasure claims.
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

## Customer application base and executable extensions (PR3)

Date: 2026-09-21. Local executed evidence on the current head:

- `npm run check` — package build, typecheck, **305 Node/SQLite/WebCrypto tests**
  (including the 8-test in-repo extension execution suite), repository checks,
  boundary checks and the licensing gate all pass; none skipped.
- `npm run core:pack` — deterministic tarballs + provenance manifest from the
  clean committed tree; `refresh:customer-lock` pins the exact artifacts into the
  starter lock template (173 packages) and re-validates integrity.
- `npm run check:workerd` — 6/6: packaged core evaluates in workerd, the
  deployment fence accepts a valid config, missing/unconfigured Access fails
  closed, an email/header shortcut never authenticates, an unknown API path
  returns JSON, static assets serve.
- `npm run acceptance:two-customers` — **16/16 steps** across two generated
  customer repositories. Each repository installs real tarballs (not symlinks),
  typechecks and builds without upstream source paths, and runs its **own
  executable template suite** (A5 requires ≥8 passing tests and zero failures per
  customer; both alpha and beta ran 12/12). Confirmed assertions include exact
  derived values (`released_hours '2.5'`, `cases '30'`), `null` (never `'0'`) on
  an empty database, unknown-metric `404`, read-only decision rules, server-side
  module gating `403` in both directions and viewer pull denial `403`.

The first acceptance run surfaced a real template-harness defect (the suite's
request helper did not pass the environment into the composed API, so post-fence
routes degraded to `500 INTERNAL_ERROR`); it was fixed and both customers
re-verified 12/12. This remains local evidence only — see
[docs/implementation/10-customer-application-base.md](docs/implementation/10-customer-application-base.md).

## Not certified

No Cloudflare deployment, live Access/D1/R2/workerd validation, deployed Queue/DLQ
consumer, load/restore/cutover, source-complete merchant reconciliation, live vendor
API or LLM call. The job boundary is a manual/local consumer, not Queue or outage
recovery evidence. No inference billing, bank ledger certification, third-party
action or autonomous write occurs.

A fixture, declared independent control, checksum or operator-supplied commit is
not merchant verification, independent attestation or production certification.
See [implementation coverage](docs/implementation/README.md) for all remaining domains.
