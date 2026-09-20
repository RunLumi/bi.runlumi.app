# Validation — PR #2 commerce foundation upgrade

Date: 2026-09-20. This file distinguishes local evidence, remote CI and production
certification. See [scope mapping](docs/pr2-commerce-alignment.md).

## Local executed evidence

- Strict core TypeScript 5.8.3 on Node 22.16.0.
- 91 Node tests using actual SQLite and generated WebCrypto JWTs; no skipped tests.
- Control/data separation; authorization, expiry/revocation, route identity/epochs.
- Pack source immutability, conflicting retries, R2 integrity, enabled AI reference
  ownership/revocation, revision/epoch activation and Git/UI edit boundaries.
- One read-batch snapshot context, concurrent publication, limits and source quality.
- Existing economics/import/grain/watermark/idempotency/role tests remain passing.
- Commerce checker: 28 specs, 334 IDs, 50 links, 16 synthetic reference cases and
  23 deliberate-rejection self-tests. These do not certify connectors.
- Frontend strict TS + Vite production build, runtime notice generation.
- Lock/provenance/license admission for 173 packages in the UI graph.

## Verified remote clean-install and browser evidence

[Verification run 35495156608](https://github.com/RunLumi/lumi-bi/actions/runs/35495156608)
completed successfully for both `core` and `web` jobs.

- PR source head: `e3ec921c9e9e1f9316e7b10502b4896d7374e3d8`.
- Tested GitHub merge ref: `9be88f8b461fd096c9575a9f2aa568f0cd9894a5`.
- Main incorporated in that merge ref: `635ca830c65d6e9c79f1476e4512eb2d57e5e75c`.
- Clean Ubuntu runner, Node 22.16.0 / npm 10.9.2, Playwright 1.62.1,
  Chromium 151.0.7922.34 (Playwright build 1234).
- Both committed package graphs installed with `npm ci --ignore-scripts`.
- Core typecheck, all 91 tests and commerce specification/oracle checks passed.
- Frontend lock/provenance/license gate, strict TS/build and runtime notices passed.
- The blocking npm advisory check reported zero vulnerabilities in this run.
  This is a point-in-time registry check, not a guarantee of vulnerability absence.
- All 10 browser tests passed, with no retries.

Browser tests cover commerce readiness; operations values/source evidence;
identity/role separation; all major views at 320, 390, 768 and 1280 pixels; absent
configuration; empty periods; and whole-dashboard refusal of a stale context.

The `frontend-evidence` artifact (ID 10600517725, seven-day retention) contains the
tested revision, asset/lock hashes, npm audit output and three screenshots:
commerce desktop, operations desktop and operations mobile. All three screenshots
were downloaded and visually checked. Artifact ZIP SHA-256:
`bb7f513c665d75531f23d6ba36674fe4971cd3b307d1597ade013a322c238da0`.

Local Chromium HTTP navigation was blocked by the execution environment
(`ERR_BLOCKED_BY_ADMINISTRATOR`); that local attempt is not counted as passing
browser evidence. The remote Playwright run above supplies actual HTTP/browser
validation. The old offline HTML smoke test is not evidence for the React app.

This evidence-record update changes documentation only. The final PR head must
still pass the verification workflow before merging; later code changes require
new evidence rather than inheriting the run above.

## Not certified by this PR

- No Cloudflare resources, deployments, real Access sessions or D1/R2 integration.
- No production throughput/fair-share admission, restoration or two-cell cutover.
- No live Nhanh/Haravan/Shopee source, merchant financial reconciliation or LLM call.
- No field/row finance policy, tenant secret broker or GitHub/OIDC source attestation.
- No payment collection, self-service billing, data-schema rollback or agent actions.

Source fetch time, fixture success, byte checksum and an operator-asserted commit
are not substitutes for merchant verification or production certification.
