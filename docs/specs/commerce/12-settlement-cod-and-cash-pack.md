# C12 — Settlement, COD and cash truth pack

Spec: C12 | Status: Target contract | Stage: P0 assisted statements, P1 certified direct feeds, P2 close workflows

Owns: settlement bridge, receivable aging, COD remittance and matching. Excludes: payment execution, legal tax advice, statutory bookkeeping and merchant P&L formulas.

## Decision

Finance operator: 'What should have been remitted, what was actually received, and why is there a difference?' Owner: 'Which unresolved cash items deserve attention today?' A transaction marked paid/delivered is not proof the merchant received money.

## Financial objects

ExpectedSettlement, Statement, StatementLine, FinancialEntry, SettlementAllocation, BankOrCarrierReceipt, ReceiptAllocation, Adjustment, MatchCase and PeriodClose. Each entry has source identity, component, sign, native currency, value date, transaction date, provisional/final state, source reference and original/reversing-entry linkage.

Receipt/entry allocations support one-to-many and many-to-one matching. Amount conservation is mandatory. Unallocated residue is retained. Unmatched bank deposits are not automatically sales; unmatched fees are not automatically fraud.

## Contract

- **C12-R01:** build a source-specific signed component bridge from merchant entitlement to payout. Distinguish seller fees, merchant/platform-funded promotions, refunds, shipping revenue/expense, reserve additions/releases, withholding and other adjustments. Withholding/reserve is not automatically an expense.
- **C12-R02:** provisional escrow estimates, finalized payout statements and observed bank/carrier receipts are separate states. Preserve each and its evidence; replacement/finalization rules prevent double counting.
- **C12-R03:** automatic exact matching is allowed for same account/currency/unique reference and conserved amounts. Fuzzy date/amount candidate matches are suggestions requiring review, with reasons and ambiguity. Never force a match to eliminate variance.
- **C12-R04:** aging uses a documented due/expected remittance date and merchant working calendar. Unknown due date is unknown, not overdue today. Partial receipt closes only the allocated amount.
- **C12-R05:** statement re-import and API/file overlap are idempotent. Source corrections create a new statement/reconciliation version and review task; closed exports are not edited in place.

## Reconciliation equation

The component schedule is versioned per source and merchant. The generic check is:

`expected_payout = sum(signed finalized entitlement/fee/refund/reserve/withholding/adjustment entries)`

`receipt_gap = expected_payout - matched_observed_receipts`

Synthetic illustration in VND: entitlement 700,000; fees −70,000; reserve addition −100,000; reserve release +20,000; withholding −30,000 → expected payout 520,000. Receipt 500,000 → gap 20,000. The gap is an investigation item, not realized recovery. Reserve and withholding must not also be subtracted from contribution as ordinary fees unless approved accounting treatment warrants it.

## Workflow

Select payout/COD period → confirm source coverage and finality → inspect bridge → match receipts → classify residuals (timing, reference mismatch, rounding, missing source, disputed charge, unclassified) → assign owner/due date → attach source evidence → record resolution and recovered cash only when a new receipt or reversed charge is observed.

P0 accepts merchant-authorized CSV/JSON statements with schema preview, decimal/currency validation, source issuer and coverage declaration. Excel imports are asynchronous, macro-free and formula-neutralized; user formulas never execute on the server. All file imports retain original checksum and row references.

P1 adds certified direct financial endpoints where access exists. P2 adds reversible accounting-export drafts and close checklists. Exports name accounting basis and integration limits; no claim Lumi filed taxes, reconciled every bank account or replaced a licensed accounting service.

## Period close

`OPEN → RECONCILING → REVIEW_REQUIRED → APPROVED_CLOSE → RESTATEMENT_REQUIRED`. Close pins source/data/semantic versions, scope and approving principal. Later fee/return adjustments produce an explicit delta report. A reconciliation snapshot is not an immutable legal record beyond retention/data-rights obligations.

## Acceptance

- **C12-A01:** the synthetic 520,000 expected/500,000 received fixture produces exactly 20,000 unmatched and zero recorded recovered cash.
- **C12-A02:** delivered COD order with no receipt remains outstanding, not received revenue/cash.
- **C12-A03:** one payout covers orders from two sales months; payout-date and sales-cohort views reconcile without moving sales to payout date.
- **C12-A04:** partial refund, negative adjustment and reserve release cannot be lost by filtering only positive statement lines.
- **C12-A05:** two candidate bank matches of equal amount remain ambiguous until reviewed.
- **C12-A06:** duplicate statement import and later direct API do not double fees, receipts or recoveries.
- **C12-A07:** new adjustment after close leaves the original report reproducible and marks a restatement task.
