# 0005: A thin UI now, replaceable framework later

Status: accepted for bootstrap. Date: 2026-09-20.

## Decision

Start with a native ES-module dashboard renderer, accessible tables and config
editing. Keep TypeScript API/core contracts independent of presentation. No
third-party runtime dependencies are required for the runnable demonstration.

## Why not start with a complete BI framework?

The first unknown is trustworthy tenant-scoped meaning and deployment economics,
not whether a chart can be drawn. A large embedded BI stack introduces licensing,
hosting, auth and metric-definition duplication before the first decision is
validated. It may still be the right choice later; run an evidence-based comparison.

## Evolution

For substantial editing, drilldown or interaction needs, evaluate React and a
maintained chart library such as ECharts with exact version/license review. Do not
hand-build a complex visual canvas to preserve "zero dependencies" as an ideology.
The current UI is not represented as a React app or a fully featured editor.

## Licensing

Original Lumi BI code remains private/reserved. Public licensing is the owner's
strategic decision and is not inherited from lumi-agents. MIT/Apache dependencies
can be candidates without automatically determining Lumi's own license. Preserve
notices and review transitive models/assets/service terms before adoption.
