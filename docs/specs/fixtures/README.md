# Commerce reference fixtures

These are **synthetic, hand-specified reference cases**, not captured customer data and not proof a provider adapter works.

`commerce-golden-cases.json` defines exact expected money, allocation, canonical deduplication, stock and time behavior. Money is represented as decimal strings; missing values are null. Cases point to the canonical acceptance IDs they exercise conceptually.

Run the mechanical checker and its mutation self-tests:

```bash
python3 scripts/check-commerce-specs.py --self-test
```

The checker uses an independent small Python/Decimal/Fraction oracle. It validates specification structure and expected reference arithmetic. It does **not** call the TypeScript query engine, D1/R2, provider APIs or model APIs. Implementation teams must bind these same cases to the actual normalizer/metric compiler and add independent adapter, authorization, failure-injection and merchant-reconciliation evidence.

Adding a case: specify the actual business meaning and expected result, link a stable acceptance ID, avoid customer identifiers, and verify the oracle rejects a deliberately wrong expected result. Do not move a hard case out of the suite to pass a release gate.
