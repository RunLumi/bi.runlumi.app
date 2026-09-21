# Semantic contract

The current semantic release is `operations-v1`. Metrics declare a reviewed ID,
label, unit, formula, and definition. Queries declare metric IDs, an explicit
upper-exclusive date range, and an optional day or workflow grouping.

The server compiles identifiers from the reviewed metric catalog and binds date
parameters. Empty data, missing source snapshots, stale coverage, and unknown
coverage remain explicit states. Financial values retain integer minor units or
an explicit decimal representation; NULL is not zero.
