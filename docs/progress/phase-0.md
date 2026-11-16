# Phase 0: Project setup and tooling

Completed 2026-11-16. Committed on branch `phase-0-setup`, before the git workflow changed (see below).

## What was built

- Next.js 16.4 app (App Router, TypeScript, Tailwind CSS 4, ESLint 9) scaffolded with `create-next-app`, no `src/` directory, `@/*` import alias.
- shadcn/ui initialised with its defaults (`base-nova` style, Base UI primitives, neutral colours, lucide icons). Only `components/ui/button.tsx` and `lib/utils.ts` exist so far.
- `docker-compose.yml` with Postgres 17 (`postgres` / `postgres`, database `workout_tracker`, port 5432, named volume, healthcheck).
- Vitest 5 (`vitest.config.mts`) and Playwright 1.65 (`playwright.config.ts`) with one project, `mobile`: Chromium with the Pixel 7 device profile.
- Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test:unit`, `test:e2e`, `check`.
- `.github/workflows/ci.yml`: runs `npm run check` on every push, Node 24, Postgres 17 service, `DATABASE_URL` set.
- `.env.example`; `.gitignore` ignores `.env*` except `.env.example`.
- `CLAUDE.md` (points to the plan, repeats the rules, imports the Next.js-generated `AGENTS.md`), `README.md`, `docs/progress/`.
- Placeholder home page with the heading "Workout Tracker".
- The plan was moved from the repository root to `docs/PLAN.md`, unchanged.

## Decisions and deviations

- **Vitest runs in the `node` environment without React Testing Library or jsdom.** The Next.js guide installs them, but the plan's unit tests cover logic and database queries, and UI flows are covered by Playwright. Add jsdom only if a later phase needs component-level unit tests.
- **The `@` alias is set by hand in `vitest.config.mts`** instead of adding the `vite-tsconfig-paths` dependency.
- **`typecheck` runs `next typegen` first.** The layout uses Next's generated `LayoutProps` type, which does not exist on a fresh checkout (CI) until types are generated.
- **Playwright tests run against a production build** (`npm run build && npm run start`), not the dev server, so E2E checks what will be deployed. Locally an already running server on port 3000 is reused.
- **`@types/node` raised from 20 to 24**; Vitest 5 requires 22 or newer. `package.json` declares `engines.node >= 22`.
- **shadcn's current default is Base UI, not Radix,** and its `cn` helper now comes from shadcn's own `cn` package instead of `clsx` + `tailwind-merge`. Both are the CLI defaults and were kept.
- shadcn's init wrote `--font-sans: var(--font-sans)` (a self-reference) into `app/globals.css`; changed to `var(--font-geist-sans)` so the Geist font loaded in `app/layout.tsx` is used.
- **Git workflow changed after this phase was built** (agreed with Adam, rule 9 in `docs/PLAN.md` updated): Adam does all commits and pushes directly to `main`; Claude no longer commits, branches or opens pull requests. The CI workflow therefore runs on push only.
- The `create-next-app` sample images in `public/` were deleted.
- `AGENTS.md` is generated and maintained by `next dev`; leave its marked block alone.

## Tests added

- Unit: `tests/unit/sample.test.ts` — Vitest runs and resolves the `@/` alias.
- E2E: `tests/e2e/home.spec.ts` — the home page loads, has the title and the heading "Workout Tracker".

## How to run and verify

```bash
npm install
npx playwright install chromium
docker compose up -d
npm run check
```

Verified locally: `npm run check` passes (lint, typecheck, 1 unit test, 1 E2E test), and the Compose Postgres starts healthy and accepts connections.

## Known gaps

- **CI has not run yet.** The workflow exists but there is no GitHub remote, so "passes in CI" from the phase's "Done when" list is still open until Adam pushes.
- Nothing connects to the database yet; `DATABASE_URL` is unused until Phase 1.
- `npm audit` reports 6 low/moderate advisories, all inside the `shadcn` CLI package (its `deepmerge` and `ts-morph` → `minimatch` dependencies). They cannot be fixed properly: `deepmerge` has no patched release, and the offered `npm audit fix --force` downgrades `shadcn` to 1.0.0. The app only imports one stylesheet from that package (`shadcn/tailwind.css`) at build time, so `shadcn` was moved to `devDependencies`; `npm audit --omit=dev` (what ships to production) reports 0 vulnerabilities. Re-check when shadcn releases an update.

## Manual steps for Adam

- [ ] Bring the phase into `main`: `git checkout main && git merge phase-0-setup`, then commit the remaining uncommitted changes.
- [ ] Follow the Phase 0 manual steps in `docs/PLAN.md`: create the private GitHub repository, `git push -u origin main`, and check the CI run is green.
