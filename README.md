# AutoCare Nexus — *From Your Driveway to Done.*
A **frontend-only simulation** of a future distributed automobile-repair platform (React + TypeScript + Vite + Tailwind). All data is fictional and stored in browser localStorage. Nothing here is a production service.

## Run
```
npm ci
npm run dev
npm test
npm run build
```
## Deploy to GitHub Pages
Push to `main`, set Pages source to **GitHub Actions**. The workflow (`.github/workflows/deploy-pages.yml`) runs lint → tests → build with `VITE_BASE=/<repo-name>/` and deploys `dist`. Hash routing keeps refresh on nested URLs working. Locally the base defaults to `./`.

## Architecture
Business rules live in `src/domain` (pure TypeScript, no React). `src/repositories` holds a `Repository` interface with a localStorage adapter that can later be replaced by an HTTP adapter. Docs: `docs/`. Architecture, Database and API pages describe a **proposed** Java/Kafka/Oracle backend that is not running.

See `IMPLEMENTATION_STATUS.md` for what is done and what remains.
