# Workout Tracker

Single-user, phone-first workout log. The full plan is in [docs/PLAN.md](docs/PLAN.md); what each finished phase built is in `docs/progress/phase-N.md`.

@AGENTS.md

## Before you start

Read `docs/PLAN.md` and every file in `docs/progress/`. Work on one phase at a time, in order.

## Rules for every phase

1. Read `docs/PLAN.md` and all earlier `docs/progress/phase-*.md` files before writing code.
2. Build only this phase's scope. Do not start features from later phases.
3. Check the current official docs for each library before installing it; versions and setup steps change.
4. Write unit tests (Vitest) for all logic added in the phase.
5. Write end-to-end tests (Playwright) for every user flow listed under the phase's "E2E tests".
6. `npm run check` (lint, typecheck, unit tests, E2E tests) must pass before the phase is called done.
7. Write `docs/progress/phase-N.md` with: what was built, decisions and deviations from the plan, tests added, how to run and verify, known gaps, manual steps for Adam.
8. Update `README.md` when setup, scripts or environment variables change.
9. Commit on a branch named `phase-N-<short-name>`; commit messages start with `phase N:`.
10. If the plan is ambiguous or turns out to be wrong, stop and ask Adam. Record agreed changes in `docs/PLAN.md`.
11. Never run destructive commands against the production database. Migrations are additive: no dropping or renaming columns that hold data without a backup and Adam's approval.
12. Keep it simple: no new dependency, abstraction or feature that this plan does not ask for.

## Commands

| Command | What it does |
| --- | --- |
| `docker compose up -d` | Start local Postgres on port 5432 |
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types, then `tsc --noEmit` |
| `npm run test:unit` | Vitest, files in `tests/unit/**/*.test.ts` |
| `npm run test:e2e` | Playwright, files in `tests/e2e/`, mobile Chromium; builds and starts the app itself |
| `npm run check` | All four of the above; must pass before a phase is done |
