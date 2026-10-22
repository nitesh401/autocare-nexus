# AutoCare Nexus

**From Your Driveway to Done.**

AutoCare Nexus is a **frontend-only simulation** of a future distributed automobile-repair platform. It demonstrates enterprise-style workflow rules, a typed domain layer, and architecture documentation for a proposed Java microservices backend. Everything runs in the browser and is deployable to GitHub Pages as a static site.

> **Not a real service.** All data is fictional. There is no backend, database, Kafka, or payment processing. Browser localStorage is not secure and must not hold real customer or payment data.

**Live demo:** `https://nitesh401.github.io/autocare-nexus/`

## What it demonstrates

- **Approval-gated repairs:** a mechanic diagnoses the issue and submits a versioned estimate. Repair work cannot start until the customer approves it and repair is authorized.
- **Immutable estimate versions:** revised or additional-work estimates need a fresh approval. Superseded, expired and already-decided estimates are refused, so there are no duplicate approvals.
- **Workshop transfer:** transport authorization is separate from repair authorization. Vehicle custody is tracked, and failed and cancelled transfers are handled.
- **Quality, payment and audit:** quality inspection must pass before a vehicle is marked ready. Payment is simulated, and every transition creates an audit event.
- **SLA engine:** a pure calculation (ON_TRACK / AT_RISK / BREACHED / COMPLETED) driven by a simulated clock, with audited extensions.
- **Inventory and dispatch:** stock reservation that can never go negative, and a deterministic mechanic-ranking algorithm.
- **Architecture, Database and API explorers:** interactive views of a *proposed* microservice system, with Mermaid diagrams. These are documentation, not running services.

## Tech stack

React 18, TypeScript, Vite, Tailwind CSS, Motion, Lucide, Recharts, Mermaid, Vitest, React Testing Library.

## Getting started

Requires Node.js 20+.

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # unit + component tests
npm run lint       # TypeScript check
npm run build      # static build in dist/
npm run preview    # serve the production build
```

## Try the demo

1. Open **Repair Journey** and select `NX-1001` (Hyundai Creta, engine warning light).
2. Click **Advance step** four times to reach diagnosis.
3. Click **Submit estimate (home)**. The estimate is about ₹8,450 including GST.
4. Click **Attempt to start repair**. The domain layer blocks it and explains why.
5. Click **Approve Estimate** or **Reject Estimate** and follow either outcome.
6. After approval, submit an additional-work estimate and see that it needs separate approval.
7. Try **Recommend transfer** to walk the workshop-transfer path.

Use **Settings → Reset demo data** to restore the seed state. The simulated clock and SLA controls are on the **SLA Monitor** page.

## Project structure

```
src/
  domain/         Pure business rules (no React): workflow, money, sla, inventory, dispatch
  repositories/   Repository interface + localStorage adapter (swappable for an HTTP adapter)
  data/           Seed data and reference data for explorers
  pages/          Page components
  app/            App shell, routing, state instance
  components/     Shared UI
tests/            Vitest tests exercising the real domain functions
docs/             Architecture, development, deployment docs and ADRs
.github/workflows/deploy-pages.yml
```

Money is stored as integer paise to avoid floating-point errors.

## Deploying to GitHub Pages

1. Push to `main`.
2. In the repo: **Settings → Pages → Source: GitHub Actions**.
3. The workflow runs `npm ci`, lint, tests and build, then deploys `dist/`.

The workflow sets `VITE_BASE=/<repo-name>/` automatically. Locally the base defaults to `./`. The app uses hash routing, so refreshing a nested URL works on static hosting.

## Documentation

See `docs/`:
- `architecture/`: system context, containers, service boundaries, repair lifecycle, estimate approval, workshop transfer, events, database design, consistency, security, SLA, observability, failure recovery, ADRs
- `development/`: setup and testing
- `deployment/github-pages.md`
- `limitations.md`

## Implemented vs. proposed

| Area | Status |
|---|---|
| Domain rules, workflow, SLA, inventory, audit | Implemented (frontend, tested) |
| localStorage persistence, reset, simulated clock | Implemented |
| Microservices, Kafka, Oracle, Keycloak, Redis, observability | Proposed architecture only |
| Payments, authentication, real dispatch routing | Simulated or not implemented |

## Known limitations

- Overview filters, volume/SLA-trend charts and estimate comparison are not built yet.
- SLA pause/resume and refunds are not implemented.
- There is no light theme; the Architecture and Database explorers are simplified.
- Lint is a TypeScript check only (no ESLint).
- The role selector is demo-only and not real authorization.

See `IMPLEMENTATION_STATUS.md` for the full list and next steps.

## License

Add a license of your choice (e.g. MIT) before publishing.
