# Synthetic commerce interchange examples

All accounts, orders, bank references and values here are synthetic. These are
**Lumi interchange files**, not sample Nhanh/Haravan/Shopee API responses.

In the local demo, select an owner, open **Nguồn & bản nhập**, authorize a generic
`shop-A` export for the file's resource type, and upload the corresponding JSON.
Normalize the retained receipt, select its build, preview and explicitly publish.
Use `orders-negative.json` to exercise the investigation/decision workflow.

Money is an exact decimal string in VND. The required tax policy is
`net-merchandise-actual-cash-v1`: merchandise excludes separable sales tax; COGS
and expenses exclude recoverable input tax; cash and settlement preserve actual
transfer amounts. No legal VAT rate is inferred. Earned subsidies and shipping
income are explicit, and unknown is `null`, not `"0"`.

The snapshot reports an order cohort (by orderedAt), as known at observedAt.
A price or cost in a current catalog is not historical COGS evidence.

For the normal orders file an independently obtained control can be declared as:

```json
[{"normalizationId":"REPLACE_WITH_SELECTED_BUILD_ID","recordCount":1,
  "netSales":"720000","expectedSettlement":null,"evidenceRef":"REPLACE_WITH_INDEPENDENT_SOURCE_REFERENCE"}]
```

The example numbers do not constitute independent verification of a real export.
Do not submit this synthetic control as merchant certification.
