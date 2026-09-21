# 3. Customer E2E validation

Run the checks in this order. Stop at the first failure; do not weaken a gate to continue.

## A. Generated-repository proof for two independent customers

From the platform root:

    npm run acceptance:two-customers

This creates temporary Alpha and Beta repositories from real packaged tarballs and verifies:

- install without symlinked upstream packages;
- typecheck and browser build without packages/*/src paths;
- each customer’s independent executable tests and custom pages/metrics;
- distinct production/staging deployment identities;
- deploy-plan rejection before hostname/Access review;
- definition-only TSX promotion without embedded financial values;
- synthetic core upgrade preserving both customer customizations;
- one-customer rollback leaving the other at the newer release.

The temporary workspace is removed unless LUMI_KEEP_ACCEPTANCE=1 is set. This is local fixture and package-consumer evidence, not live deployment evidence.

## B. Run the generated customer locally

Inside the generated customer repository:

    npm run dev

Open http://127.0.0.1:8787. The local server is loopback-only, memory-backed, and synthetic. In the UI:

1. Select the owner identity.
2. Open Nguồn & bản nhập.
3. Authorize an authorized-export source.
4. Upload a synthetic interchange file from examples/commerce/orders-negative.json.
5. Normalize the retained receipt.
6. Select the normalized source and create a preview.
7. Review warnings, source scope, and exact values.
8. Publish with an explicit review reason.
9. Open Số liệu thương mại.
10. Ask a supported question in Hỏi Lumi, refine by source or explicit comparison dates, save an insight, refresh it, and inspect preserved run history.
11. Open Việc & kết quả and create a human-owned investigation from an observed finding.

Expected behavior:

- unknown, stale, revoked, or unavailable data remains visibly unavailable;
- missing cost/fee components are not replaced with zero;
- a target is an annotation, not an observed result;
- decisions do not execute external actions;
- viewer/revoked identities cannot recover owner-only financial evidence.

## C. Browser regression

From the platform root, after building the frontend:

    npm run build:web
    ./apps/web/node_modules/.bin/playwright install chromium
    npm --prefix apps/web run test:e2e

The browser suite covers source onboarding, normalization/publication, exports, investigations, stale/revoked states, identity switching, mobile widths, overflow, configuration honesty, and operations dashboard evidence.

## D. Full platform gate

    npm run check
    npm run check:commerce
    npm run acceptance:two-customers

Hosted CI is a separate proof layer. A passing local E2E test does not certify Cloudflare bindings, Access, provider completeness, or merchant approval.
