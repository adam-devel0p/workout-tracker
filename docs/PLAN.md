# Workout Tracker — Implementation Plan

Nov 16, 2026 · @Adam

## Assumptions and decisions

The plan builds a single-user, phone-first web app in seven phases, hosted for free. Adam confirmed Google login and that there is no data to migrate: the app starts empty and is the only place workouts are recorded.

| Topic | Decision |
| --- | --- |
| Users | One user (Adam). No sign-up, no roles, no sharing. |
| Hosting | Next.js on Vercel Hobby, Postgres on Neon Free. |
| Login | Google sign-in, restricted to one allow-listed email address. |
| Weight | Stored in kg, optional per set. Bodyweight exercises leave it empty. |
| Workouts | One workout per calendar date. A second session on the same day adds to it. |
| Device | Designed for a phone screen first; desktop just has to work. |
| Out of scope | Timers, training programs, supersets, RPE, offline mode. See "Later ideas". |

## How to use this plan

Save this document in the repository as `docs/PLAN.md` and implement one phase per new Claude session, in order. Each session starts with no memory, so the plan and the phase logs are the only handover.

**Prompt to start each session**

```text
Read docs/PLAN.md and every file in docs/progress/. Implement Phase N only,
following the "Rules for every phase". Stop when the phase's "Done when" list
is met, and tell me which manual steps I need to do.
```

**Rules for every phase**

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

## Stack and architecture

One Next.js project holds the UI and the server code; it talks to one Postgres database. A nightly job outside both providers keeps backups.

| Concern | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js (App Router) + TypeScript | Server Actions for all writes; no separate API layer. |
| UI | Tailwind CSS + shadcn/ui | Its Combobox is the exercise picker. |
| Database | Postgres: Neon in production, Docker Compose locally and in CI | Same engine everywhere, so tests are realistic. |
| Data access | Drizzle ORM + drizzle-kit migrations | Migrations are committed SQL files. |
| Validation | Zod | One schema per form, shared by client and server. |
| Auth | Auth.js with the Google provider | Confirm at Phase 2 that it is still the recommended library; otherwise use the current equivalent. |
| Charts | Recharts | Line and bar charts only. |
| Unit tests | Vitest | DB tests run against the Docker Postgres. |
| E2E tests | Playwright | Mobile viewport as the default project. |
| CI | GitHub Actions | Runs `npm run check` with a Postgres service on every push. |
| Hosting | Vercel Hobby | Auto-deploys from `main`. |
| Backups | GitHub Actions nightly `pg_dump` to a private repo | Independent of Vercel and Neon. See Phase 6. |

**Folder layout**

```text
app/                 routes: / (log), /history, /exercises, /dashboard, /sign-in
components/          UI components
lib/db/              schema.ts, client.ts, queries/ (all SQL lives here)
lib/metrics/         pure functions: volume, estimated 1RM, records
lib/validation/      Zod schemas
tests/unit/          Vitest
tests/e2e/           Playwright
scripts/             seed, backup, restore
docs/                PLAN.md, progress/phase-N.md, RESTORE.md
```

## Data model

Four tables: an exercise is stored once and reused on any day; each set is its own row. Metrics are calculated in queries and never stored.

```sql
CREATE TABLE exercise (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  archived_at TIMESTAMPTZ,                    -- hidden from the picker, history kept
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX exercise_name_unique ON exercise (lower(name));

CREATE TABLE workout (
  id         SERIAL PRIMARY KEY,
  date       DATE NOT NULL UNIQUE,            -- one workout per day
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workout_exercise (               -- an exercise done in a workout
  id          SERIAL PRIMARY KEY,
  workout_id  INT NOT NULL REFERENCES workout(id) ON DELETE CASCADE,
  exercise_id INT NOT NULL REFERENCES exercise(id) ON DELETE RESTRICT,
  position    INT NOT NULL,                   -- order within the workout
  UNIQUE (workout_id, exercise_id)
);

CREATE TABLE workout_set (
  id                  SERIAL PRIMARY KEY,
  workout_exercise_id INT NOT NULL REFERENCES workout_exercise(id) ON DELETE CASCADE,
  set_number          INT NOT NULL CHECK (set_number > 0),
  reps                INT NOT NULL CHECK (reps > 0),
  weight_kg           NUMERIC(6,2) CHECK (weight_kg >= 0),   -- NULL = bodyweight
  UNIQUE (workout_exercise_id, set_number)
);
```

**Rules**

- Exercise names are trimmed and unique regardless of case: "bench press" and "Bench Press" are the same exercise.
- An exercise that has been used cannot be deleted, only archived or renamed.
- Deleting a workout removes its exercises and sets.
- Volume = sum of `reps * weight_kg`. Estimated 1RM (Epley) = `weight_kg * (1 + reps / 30.0)`.
- For sets without weight, dashboards show rep-based metrics only.

## Phase 0: Project setup and tooling

**Goal:** an empty app that runs locally, with tests and CI working, so every later phase only adds features.

**Tasks**

1. Scaffold Next.js (App Router, TypeScript, Tailwind, ESLint) and add shadcn/ui.
2. Add `docker-compose.yml` with Postgres for local development and tests.
3. Add Vitest and Playwright (default project: mobile viewport, Chromium).
4. Add scripts: `dev`, `lint`, `typecheck`, `test:unit`, `test:e2e`, and `check` running all four checks.
5. Add a GitHub Actions workflow that runs `npm run check` with a Postgres service.
6. Add `.env.example` and make sure `.env*` files are git-ignored.
7. Create `CLAUDE.md` pointing to `docs/PLAN.md` and repeating the "Rules for every phase".
8. Create `docs/progress/` and a `README.md` with setup steps.
9. Add a placeholder home page showing the app name.

**Unit tests:** one sample test proving Vitest runs.

**E2E tests:** the home page loads and shows the app name.

**Manual steps for Adam:** create a private GitHub repository and push.

**Done when:** `npm run check` passes locally and in CI, and `docs/progress/phase-0.md` exists.

## Phase 1: Database and data layer

**Goal:** the schema exists and every read and write the app needs is a tested function. No UI yet.

**Tasks**

1. Define the four tables from "Data model" in `lib/db/schema.ts` and generate the first migration.
2. Add scripts `db:migrate` and `db:seed` (seed is for local development only).
3. Write query functions in `lib/db/queries/`:
   - exercises: search by text, create (trim, reuse existing on case-insensitive match), rename, archive, unarchive
   - workouts: get by date, create if missing, update notes, delete, list with summaries
   - workout exercises: add to a workout, remove, reorder
   - sets: add, update, delete (renumbering the rest), last session's sets for an exercise
4. Write pure metric functions in `lib/metrics/`: set volume, session volume, estimated 1RM, best set.
5. Add Zod schemas for exercise names, reps and weight.

**Unit tests**

- Creating "bench press" when "Bench Press" exists returns the existing row.
- A used exercise cannot be deleted; archiving hides it from search but keeps history.
- Deleting a workout removes its exercises and sets.
- Constraints reject zero or negative reps and negative weight.
- Two workouts on the same date are rejected; "create if missing" returns the existing one.
- Metric functions, including sets with no weight.

**E2E tests:** none new; the Phase 0 smoke test still passes.

**Manual steps for Adam:** none.

**Done when:** migrations apply cleanly to an empty database and all query functions are covered by tests.

## Phase 2: Login for one user and first deploy

**Goal:** the app is live on a public URL and only Adam can get past the sign-in page.

**Tasks**

1. Add Google sign-in. Allow a session only when the verified email equals the `ALLOWED_EMAIL` environment variable.
2. Protect every route except `/sign-in` with middleware.
3. Add one `requireUser()` helper and call it at the top of every Server Action and data-loading function. Middleware alone is not enough.
4. Add a sign-in page, a sign-out button and a clear "not authorised" message for any other account.
5. Add `robots.txt` and a `noindex` header so the site is not listed by search engines.
6. Add a test-only login used by Playwright. It must be impossible to enable in production: guard it on an `E2E_TEST` flag and refuse to start if that flag is set on Vercel production.
7. Create the production database and run migrations against it.
8. Deploy to Vercel and set the environment variables.

**Unit tests**

- The allow-list check accepts only the exact configured email (case-insensitive) and rejects everything else, including an empty or missing value.
- Each Server Action rejects a call without a session.
- The test-only login is disabled when the production flag is set.

**E2E tests**

- A visitor without a session is redirected to `/sign-in` from every route.
- The test user reaches the home page and can sign out.
- A non-allowed email is refused and sees the "not authorised" message.

**Manual steps for Adam**

- [ ] Create a Google OAuth client and add the local and production callback URLs.
- [ ] Create a Neon project and copy the connection string.
- [ ] Import the repository in Vercel and set `DATABASE_URL`, `AUTH_SECRET`, the Google client ID and secret, and `ALLOWED_EMAIL`.
- [ ] Sign in on the production URL, then try a second Google account and confirm it is refused.

**Done when:** the production URL works for Adam's account only, and CI is green.

## Phase 3: Workout logging

**Goal:** logging a full workout on a phone takes a few taps per set, and nothing typed is ever lost silently.

**Tasks**

1. Home page `/` shows the workout for a date, defaulting to today, with previous-day and next-day buttons and a date picker.
2. Exercise picker (combobox):
   - typing filters existing, non-archived exercises, case-insensitive, matching anywhere in the name
   - names that start with the typed text are listed first, then the most recently used
   - selecting one adds it to the workout
   - when no exact match exists, the last option is "Add '\<typed text>'"; choosing it creates the exercise and adds it
   - an exercise already in today's workout is not added twice; the picker jumps to it instead
3. Each exercise card lists its sets as rows of reps and weight, using numeric keyboards on mobile.
4. "Add set" copies the values of the set above it. The first set of an exercise is pre-filled from the last session of that exercise.
5. Show the last session's sets for that exercise as a small reference line on the card.
6. Save each change automatically when a field loses focus, and show a visible "Saved" or "Not saved, retry" state per row.
7. Allow removing a set and removing an exercise from the workout, with confirmation for the exercise.
8. Optional notes field for the workout.

**Unit tests**

- Picker filtering and ordering, including when the "Add" option appears.
- Zod validation: reps must be a positive whole number, weight zero or more with up to two decimals, comma accepted as decimal separator.
- Pre-fill logic from the previous set and from the last session.

**E2E tests**

- Log a workout with an existing exercise and three sets; reload; the data is still there.
- Type a new exercise name, choose "Add", log a set; on another date the new exercise appears in the picker.
- Typing an existing name in different letter case selects the existing exercise and creates no duplicate.
- A failed save shows the retry state and keeps the typed values.
- Removing a set renumbers the remaining sets.

**Manual steps for Adam:** log one real workout on the phone and note anything slow or awkward in `docs/progress/phase-3.md`.

**Done when:** a real workout can be logged on production from a phone.

## Phase 4: History and editing

**Goal:** any past workout can be found, corrected or deleted, and the exercise list can be kept tidy.

**Tasks**

1. `/history`: workouts newest first, each showing date, exercises, number of sets and total volume. Load more on scroll or with a button.
2. Tapping a workout opens it in the Phase 3 logging screen for that date, so editing and logging share one screen.
3. Logging for a past date works through the date picker.
4. Delete a workout, with a confirmation that names the date.
5. "Repeat this workout today": copies the exercises and sets of a past workout into today's as a starting point.
6. `/exercises`: list all exercises with times used and last used date; rename; archive and unarchive.
7. Add simple navigation between Log, History, Exercises and (later) Dashboard, reachable with a thumb on a phone.

**Unit tests**

- Workout summary calculation (sets, reps, volume) including bodyweight sets.
- Renaming to a name that already exists is rejected with a clear message.
- "Repeat" copies exercises in order and does not duplicate an exercise already in today's workout.

**E2E tests**

- Edit a set in a past workout; the history summary shows the new value.
- Delete a workout; it disappears from history.
- Rename an exercise; the new name shows in history and in the picker.
- Archive an exercise; it is gone from the picker but still visible in past workouts.
- Repeat a past workout into today.

**Manual steps for Adam:** none.

**Done when:** every logged value can be changed or removed from the UI.

## Phase 5: Progress dashboards

**Goal:** `/dashboard` answers "am I getting stronger and am I training consistently?" in three simple views.

All views share a time-range filter: 4 weeks, 3 months, 1 year, all time. All numbers come from tested functions in `lib/metrics/` or queries in `lib/db/queries/`, never from chart components.

| View | What it shows |
| --- | --- |
| Overview | Workouts per week (bar chart), total sets, reps and volume per week, weeks trained in a row, date of last workout. |
| Exercise | For one selected exercise, a chart per session with a metric switch: estimated 1RM, top-set weight, total volume, total reps, best reps in a single set. |
| Records | Per exercise: heaviest weight, best estimated 1RM, most reps in one set, highest session volume, each with its date. |

**Tasks**

1. Build the three views as tabs on `/dashboard`.
2. In the Exercise view, show the change against the previous session and against about four weeks earlier, as a value and percentage with an up or down marker.
3. For exercises logged without weight, offer only the rep-based metrics.
4. Show useful empty states: no data yet, or only one session so no trend.
5. Mark a new personal record on the logging screen when a saved set beats the previous best.
6. Add a development seed with about three months of realistic data for testing the charts.

**Unit tests**

- Each metric against a small fixed data set with hand-calculated expected values.
- Week grouping (weeks start on Monday) and the weeks-in-a-row count, including gaps.
- Change calculation when there is no earlier session to compare with.
- Record detection, including ties (the earliest date keeps the record).

**E2E tests**

- With seeded data, each view renders and shows a known value from the seed.
- Switching exercise, metric and time range updates the chart.
- A bodyweight exercise offers only rep-based metrics.
- An empty database shows the empty state instead of an error.

**Manual steps for Adam:** none.

**Done when:** the three views work on production with real data.

## Phase 6: Backups, export and data safety

**Goal:** no single mistake or provider problem can lose the workout history. A copy of all data exists outside Neon and Vercel, and restoring it has been tried once.

If real workouts are being logged before the dashboards are built, run this phase directly after Phase 3; it does not depend on Phases 4 and 5.

| Risk | Protection |
| --- | --- |
| Accidental delete in the app | Confirmations (Phases 3 and 4) and the nightly backup. |
| A bad migration | Additive-only migration rule, plus an automatic backup before each production migration. |
| Database provider outage, account problem or free-plan change | Nightly dump stored in a private GitHub repository. |
| Backups that silently stop | The workflow fails loudly; GitHub emails Adam on failure. |
| A backup that cannot be restored | Documented restore script and one real restore drill. |

**Tasks**

1. Add a scheduled GitHub Actions workflow that runs `pg_dump` against production every night and commits the dump to a separate private repository, for example `workout-tracker-backups`.
2. Keep the last 30 daily dumps and one per month beyond that; add a manual "run now" trigger.
3. Make the workflow fail if the dump is empty or smaller than the previous one by more than half.
4. Add `scripts/restore.sh` and `docs/RESTORE.md` describing a restore into a new database step by step.
5. Run a backup automatically before production migrations.
6. Add an in-app "Export my data" button that downloads everything as one JSON file and as CSV.
7. Add a small "last backup" line in the app footer, read from the backup repository or a timestamp table.
8. Note in `docs/RESTORE.md` what Neon's own restore feature offers on the current plan, as a second layer.

**Unit tests**

- Export contains every exercise, workout and set, and importing that JSON into an empty test database reproduces identical data.
- CSV export escapes commas and quotes in exercise names and notes.
- Retention logic keeps and removes the right files for a given list of dates.

**E2E tests**

- The export button downloads a file that contains a known seeded workout.
- The export route is refused without a session.

**Manual steps for Adam**

- [ ] Create the private backup repository and add the database URL and a repository token as GitHub Actions secrets.
- [ ] Trigger the backup manually and check the dump appears.
- [ ] Do one restore drill into a local database by following `docs/RESTORE.md`.

**Done when:** a nightly dump has appeared on its own, and the restore drill succeeded.

## Later ideas (not in this plan)

These are deliberately left out to keep the first version small. Add them as new phases only after the seven phases above are done.

- Install to the phone home screen and log without a connection
- Rest timer between sets
- Workout templates or a weekly program
- Body weight and body measurements
- Effort rating per set (RPE) and notes per set
- Supersets
- Switching between kg and lb
- Muscle-group tags on exercises and volume per muscle group
