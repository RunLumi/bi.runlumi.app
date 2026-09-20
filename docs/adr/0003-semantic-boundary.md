# 0003: A trustworthy number is the product

Status: accepted for bootstrap. Date: 2026-09-20.

## Decision

Clients submit metric IDs and bounded filters, not SQL. Server-reviewed expressions
compile to prepared statements. Dashboards are JSON over the same semantic contract
that future alerts and agents will use. Source snapshots are immutable references;
published pointers and lineage are read consistently with results.

## Economic integrity

Baseline effort, residual effort, capacity released, avoided expense and actual cash
savings are different quantities. VND stays integer. Unknown/empty observations do
not become zero. Nonpositive net cash benefit means no cash payback calculation.

## Tradeoff

The current model is narrow and cannot express every customer question. That is
preferable to a broad ungoverned SQL endpoint. Expand metric definitions, grain,
join rules and review workflow together. Do not rely on an LLM to decide that two
fields from different ERPs both mean recognized revenue.

## Revisit

When three real customers require repeated new dimensions or metrics, extend the
contract with golden query fixtures and business-owner review. The schema is the
product boundary; a chart library is replaceable.
