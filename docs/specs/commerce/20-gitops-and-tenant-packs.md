# C20 — GitOps, semantic releases and tenant BI packs

Spec: C20 | Status: Target contract | Stage: P0 platform-authored packs; P1 tenant GitOps; P2 advanced reviewed queries

Owns: safe customization and immutable activation. Source truth is C07; metric meaning is C09; execution permissions are C22/C21.

## Outcome

Each merchant can version dashboards, mappings, metrics, AI profiles/prompts, thresholds and analytical templates without a fork of Lumi. A merchant-specific change affects only the intended tenant and can be rolled back as configuration independently of application deployment.

## Pack layout

```text
tenant-pack/
  manifest.json
  pack.lock.json
  sources/           # logical source aliases, no credentials
  mappings/          # reviewed source-to-canonical definitions
  metrics/           # versioned declarative definitions
  dashboards/
  queries/           # optional reviewed templates, not runtime free SQL
  ai/profiles/
  ai/prompts/
  alerts/
  actions/           # proposal templates, never policy authority
  tests/fixtures/    # synthetic only
```

Layer resolution: platform schema → pinned shared packs → explicit tenant overrides → local draft. Name collisions and incompatible metric semantics fail compile; there is no undocumented last-file-wins behavior.

## Contract

- **C20-R01:** manifest declares schema/runtime compatibility, source requirements, metric dependencies, files and checksums. Lock all shared pack versions/content hashes. Do not compile against `latest` during production publication.
- **C20-R02:** Git carries no customer rows, raw exports, personal information, credentials or executable workflow secrets. Credential/model/source references are logical IDs resolved and tenant-validated by trusted control services.
- **C20-R03:** publisher maps repository/installation/ref to tenant in server-owned configuration. A manifest cannot set another tenant, database, bucket or arbitrary model endpoint. PR validation uses no production secrets and never executes tenant repo scripts.
- **C20-R04:** every publication validates schemas, dependency DAG, join grains, metric semantics, access scope, query budget, UI snapshots and AI prompt regression. Material finance changes require data-steward review; security scope changes require separate authorized review.
- **C20-R05:** compile an immutable bundle; upload to private R2; record candidate in tenant D1; verify hashes/compatibility; compare-and-swap active release pointer against expected revision and route epoch. No production request reads GitHub main directly.
- **C20-R06:** rollback switches a compatible configuration pointer; it does not undo data migrations, send actions, model API charges or privacy deletions. Keep config and data-version compatibility explicit.

## Customization boundaries

L0: labels, theme tokens permitted by DESIGN.md, layout, filters and saved views. L1: source mappings, metric ASTs, dashboard/alert definitions and AI profiles. L2: reviewed shared connectors/widgets/templates. L3: isolated tenant-specific code only with threat model, maintenance owner, cost and exit plan. Never evaluate tenant JS/Python/SQL with a shared Worker’s database/secrets authority.

SQL extension path: trusted reviewers compile a template with allowed relations/functions/parameters, row-scope rules and cost tests into an isolated read-only execution plan (C10). 'Begins with SELECT' is not validation. A normal dashboard editor or LLM cannot grant this capability.

## Repository access model

An internal private config monorepo is acceptable while only Lumi staff have access. Customers editing source receive separate private tenant repositories or an equivalent enforced repository-level boundary. CODEOWNERS is a review mechanism, not folder confidentiality. Separate customer config repos are not application forks.

## UI/Git concurrency

Each asset is UI-managed or Git-managed. For Git-managed assets, UI edits create drafts/PRs against a known commit and show drift/conflict. They cannot overwrite production directly and later be silently replaced by Git sync. Promotion is explicit. Concurrent PRs use optimistic revision and environment checks.

## AI profiles

Profile declares provider instance/model alias, secret reference, permitted tools, data-egress policy, budget, prompt files and eval suite. All are bounded by organization policy. Prompt edits can change explanation style; changing a metric meaning requires the metric pipeline. Model changes cannot silently widen local/cloud/residency policy.

## Acceptance

- **C20-A01:** modify A's dashboard/prompt; compile/publish/rollback leaves B's release and results unchanged.
- **C20-A02:** pack points at B's credential/source or a new external model URL: publication fails.
- **C20-A03:** a PR containing a script/malicious template cannot access production credentials or execute in the trusted publisher.
- **C20-A04:** same shared version but different content hash fails lock verification.
- **C20-A05:** simultaneous UI/Git edits produce a conflict, never silent overwrite.
- **C20-A06:** incompatible data schema blocks rollback and explains the recovery path.
- **C20-A07:** a definition change that alters historical margin requires a versioned release, impact diff and acceptance fixtures.
