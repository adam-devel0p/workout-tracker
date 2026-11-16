# Workout Tracker

A single-user, phone-first web app for logging workouts and seeing progress. Built with Next.js (App Router), Tailwind CSS, shadcn/ui and Postgres.

The implementation plan is in [docs/PLAN.md](docs/PLAN.md). Notes on each finished phase are in [docs/progress/](docs/progress/).

## Requirements

- Node.js 22 or newer (CI uses 24)
- Docker, for the local Postgres database

## Setup

```bash
npm install
npx playwright install chromium   # browser for the E2E tests
cp .env.example .env.local
docker compose up -d              # Postgres on localhost:5432
npm run dev                       # http://localhost:3000
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` / `npm run start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate Next.js route types and run `tsc --noEmit` |
| `npm run test:unit` | Unit tests (Vitest), in `tests/unit/` |
| `npm run test:e2e` | End-to-end tests (Playwright, mobile Chromium), in `tests/e2e/` |
| `npm run check` | Lint, typecheck, unit tests and E2E tests; this is what CI runs |

`npm run test:e2e` builds and starts the app on port 3000 by itself. Outside CI it reuses a server already running on that port, so stop `npm run dev` first if you want the tests to run against a fresh production build.

## Environment variables

Copy `.env.example` to `.env.local`. All `.env*` files except `.env.example` are git-ignored.

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. The example value matches `docker-compose.yml`. Not read by the app until Phase 1. |

## Database

```bash
docker compose up -d      # start
docker compose down       # stop, keep data
docker compose down -v    # stop and delete local data
```

## CI

`.github/workflows/ci.yml` runs `npm run check` on every push, with a Postgres 17 service container.
