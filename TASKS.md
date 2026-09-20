# Active implementation backlog

The authoritative code/remaining-feature inventory is
[docs/implementation/README.md](docs/implementation/README.md). The C00–C27 suite
remains the target, not a statement that every feature is implemented.

Next code milestone: governed commerce metric catalog and typed, bounded queries
using the same publication evidence; then source/field scopes, credentials and job
admission before live provider sync. Preserve exact-money and source-revocation tests.

Release gates remain: clean final-head CI; real workerd/Access/D1/R2; two-tenant
staging; source completeness; independent merchant reconciliation; backup/restore;
measured latency/cost and supported failure recovery.

Do not close these gates with mock labels, interfaces, source counts or documentation.
