# Implementation status
## Completed
- Domain layer: estimate versions, approval/authorization separation, repair-start guard, workshop transfer + custody, QC, simulated payment, audit events, SLA (pure), inventory, dispatch ranking, integer-paise money.
- localStorage repository, explicit reset with confirmation, simulated clock.
- All 14 navigation pages, interactive Repair Journey, Mermaid-based Architecture/Database explorers, API mock runner.
- 22 Vitest tests; GitHub Pages workflow; docs set (concise).
## Pending / simplified
- Overview filters (date, status, location, service type), repair-volume and SLA-trend charts.
- Estimate version comparison view, repair details drawer, timeline view.
- SLA pause/resume; refund workflow; invoice file download beyond browser print.
- Light theme toggle; collapsible desktop sidebar; focused mobile ER/architecture layouts are basic.
- Architecture Explorer: per-service API examples/failure strategies are generic; ER diagrams are generated from simplified columns.
- Full Oracle DDL for all 13 required tables; docs are brief and should be expanded.
- Lint is TypeScript-only (no ESLint). Role selector is demo-only gating.
## Commands run
npm install, vitest run, tsc --noEmit, vite build.
## Next steps
Implement pending items above in that order; expand docs; add React Testing Library tests for Journey actions.
