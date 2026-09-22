# Nhanh.vn customer playbook (operator-managed deployment)

This playbook is for customers who sell through **Nhanh.vn** and are deployed
under the **operator-managed model**: RunLumi owns the Cloudflare account,
pays Cloudflare directly, and the customer reimburses the recorded costs. It
turns the generic journey in chapters 3–9 into concrete steps for one Nhanh
customer, using `bagaofficial.com` as the worked example.

Honest scope statement, as of this writing:

| Capability | Status |
| --- | --- |
| Authorized-export import (files exported from the Nhanh UI, mapped and uploaded) | **Supported** — the day-1 path |
| Live Nhanh v3 API synchronization (https://apidocs.nhanh.vn/v3) | **Not implemented yet** — planned adapter; do not sell or promise it |
| Independent reconciliation sign-off against the merchant's books | Manual procedure — required before go-live |

Do not describe the current integration as a Nhanh API connection. The platform
deliberately treats source files as immutable, checksummed evidence, and the
authorized-export workflow keeps that guarantee while the live adapter is built.

## 0. Operating model and billing

- One Cloudflare account owned by RunLumi hosts all customer installations.
  Each customer still gets its own Worker, hostname, D1 database and private
  R2 bucket inside that account — isolation is per-installation resources, not
  per-account.
- Every billable resource is recorded in the customer's billing inventory (see
  the template in chapter 12's inventory table): resource ids, creation date,
  and the plan they sit on. The customer reimburses Cloudflare costs plus the
  agreed service fee.
- Because RunLumi operates the deployment, RunLumi (as licensor of the
  Elastic-2.0 codebase) grants the managed-hosting right in the customer's
  service agreement. Record that agreement reference in the inventory.

## 1. One-time: customer repository

Generate the customer repository **outside the platform repository** — it is
an independent Git repo, not a folder of this one:

```bash
# working directory: the Lumi BI platform repository
npm run core:pack                      # immutable release artifacts

# destination: a sibling directory (or anywhere outside the platform repo)
npm run customer:new -- \
  --customer baga \
  --name 'Baga Official' \
  --env production \
  --dest ../lumi-customers/baga
```

Then, in the generated repository: `git init && git add -A && git commit -m
"initial customer application"`, followed by `npm ci --ignore-scripts`,
`npm run validate`, `npm run typecheck`, `npm run build`, `npm test` — all must
pass before any Cloudflare resource exists. The platform repo also ignores
`/customers/` as a guardrail, but do not rely on that: keep customer repos out
of it.

## 2. One-time: resources, secrets, schema, deploy

All Cloudflare work happens in the RunLumi-owned account:

```bash
# working directory: the generated customer repository
npx wrangler d1 create baga-prod-db
npx wrangler r2 bucket create baga-prod-sources
```

Record both ids in `infra/environments/production.json`, set the reviewed
hostname (e.g. `baga.bi.runlumi.app` or a subdomain the customer owns, such as
`bi.bagaofficial.com` — if it is on the customer's zone, they add the DNS
record; the hostname must be reviewed: `hostnameReviewed: true`), then:

```bash
npx wrangler secret put SETUP_TOKEN --config apps/worker/wrangler.jsonc
npm run migrate -- --remote          # applies + records all installation migrations
npm run validate && npm run build && npm test
npm run deploy:plan -- production    # review gate; creates nothing
npx wrangler deploy --config apps/worker/wrangler.jsonc
```

Open the hostname, run one-time setup (owner email + password), create the
staff accounts (chapter 7), and confirm setup is permanently closed
(`/api/setup/status` → `initialized: true`).

## 3. Nhanh authorized-export workflow (supported today)

The Nhanh UI exports the three source kinds the platform consumes. Run this
loop weekly (or on agreed dates), from the owner account:

1. **Export from Nhanh**: orders (with cost/discount/fee fields), delivery and
   payment/settlement statements, and an inventory snapshot. Export date
   ranges must not overlap previously published windows unless re-exporting
   the same window deliberately (a newer observation replaces the older one —
   the publish gate enforces monotonicity).
2. **Map to the canonical export contract** (`lumi.commerce.export.v1`):
   per-order `merchandise`, `sellerDiscount`, `merchandiseReversal`, `cogs`
   (with `cogsEvidenceRef`), `variableFees`, `shippingIncome`, `earnedSubsidy`,
   recognized timestamp, and for settlements the component/receipt split. Money
   is exact integer VND (no decimals); a missing cost stays `null` — never 0.
3. **Wrap in the envelope** and upload on the **Commerce** page (connection,
   account, resource type, approval ref, window, raw JSON). The schema
   fingerprint can be produced from the customer repository:

   ```bash
   # working directory: the generated customer repository
   node --experimental-strip-types -e \
     "import('@runlumi/core/commerce-model.ts').then(m=>m.commerceSchemaFingerprint()).then(console.log)"
   ```

4. **Normalize and publish**: accept the receipt, run the normalization job,
   select the normalized builds, preview, review warnings, publish.
5. **Verify**: reconcile the published metrics (net sales, recognized orders,
   expected settlement, observed cash, stock) against the Nhanh report and the
   bookkeeper's numbers for the same window. Record the comparison — this is
   the go-live evidence FIRST_CUSTOMER_GO requires.

Expected warnings on any first publication (`SOURCE_COMPLETENESS_UNVERIFIED`,
`MISSING_HISTORICAL_COGS`, `MISSING_INDEPENDENT_CONTROLS`, …) are the product
working correctly: they state what the source did not cover instead of
inventing numbers. Work through them with the customer; they disappear only
when the data genuinely covers the gap.

## 4. Live Nhanh v3 adapter (planned — not shipped)

The adapter will be a reviewed connector in `customer/data/connectors.ts`
(first pilot, then reusable): credentials as local secrets, shop/warehouse
scope selection, incremental pull with checkpoint state, reconciliation pass,
dedupe — feeding the existing immutable receipt pipeline. Requirements to
start: the customer's Nhanh API credentials (per https://apidocs.nhanh.vn/v3),
written permission to pull their data, and the reconciled export baseline from
step 3. Until that ships, keep selling the authorized-export workflow.

## 5. Go-live checklist

- [ ] Setup closed permanently; owner + at least one backup owner active
- [ ] Staff accounts created with least-privilege roles (chapter 7)
- [ ] First publication reconciled against Nhanh and the bookkeeper; record
      the signed comparison
- [ ] Backup executed once (`wrangler d1 export`) and restore rehearsed (chapter 12)
- [ ] Billing inventory updated (resource ids, dates, plan)
- [ ] Service agreement reference recorded (managed-hosting grant)
