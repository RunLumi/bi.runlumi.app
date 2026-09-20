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

## Browser and clean-install gate

10 Playwright tests cover commerce readiness; operations values/source evidence;
identity/role separation; all major views at 320, 390, 768 and 1280 pixels; absent
configuration; empty periods; whole-dashboard refusal of a stale context.

Local Chromium HTTP navigation is blocked by the execution environment
(`ERR_BLOCKED_BY_ADMINISTRATOR`). This is not counted as passing browser evidence.
The final `verify` GitHub Actions workflow installs the committed lock in a clean
runner, runs advisory/provenance/build gates, runs the actual browser tests and
uploads screenshots/test traces and tested-revision/asset hashes. Merge requires
that final-head workflow to pass. The old offline HTML smoke test is not evidence
for the new React application.

## Not certified by this PR

- No Cloudflare resources, deployments, real Access sessions or D1/R2 integration.
- No production throughput/fair-share admission, restoration or two-cell cutover.
- No live Nhanh/Haravan/Shopee source, merchant financial reconciliation or LLM call.
- No field/row finance policy, tenant secret broker or GitHub/OIDC source attestation.
- No payment collection, self-service billing, data-schema rollback or agent actions.

Source fetch time, fixture success, byte checksum and an operator-asserted commit
are not substitutes for merchant verification or production certification.
