# Chronos — No-Red Habit Tracker: Design

## Goal

A multi-user web app for tracking habits by the "no-red" principle. Each user defines habits with a frequency,
a bare-minimum (YELLOW) and a target (GREEN), marks each period RED / YELLOW / GREEN, and sees week and month
infographics plus streaks.

Reference project: `../Dionysus` (same stack, deployment and testing setup; not its single-owner auth).

## Stack and layout

- `api/` — Spring Boot 4.1 (Java 21), `spring-boot-starter-webmvc`, `-security`, `-jdbc`, `-flyway`,
  `-session-jdbc`, `-validation`; Postgres 17 (`docker-compose.yml` for local). Package `com.chronos`:
  - `core` — `auth`, `user`, `config`, `error`, `web`
  - `habit` — habits, pauses, check-ins
  - `stats` — period computation, week/month views, streaks
  - each split into `controller`, `service`, `repository`, `model`, `dto` as needed.
- `web/` — Vite + React 19 + TypeScript, TanStack Query, react-router, Tailwind 4. `npm run dev` proxies `/api` to `:8080`.
- Root `Dockerfile` builds the web app into the API's static resources and runs one jar (same origin, so the session
  cookie just works). `render.yaml` deploys one Docker web service with health check `/api/public/health`.
- Environment: `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD`, `COOKIE_SECURE` (default `true`), `PORT` (default `8080`).

## Data model (Flyway `V1__init.sql`)

| Table | Columns |
|---|---|
| `app_user` | `id`, `username` (unique, case-insensitive, 3–32 chars `[a-zA-Z0-9_.-]`), `password_hash` (bcrypt), `timezone` (IANA id), `created_at` |
| `habit` | `id`, `user_id` → `app_user`, `name` (1–80), `min_text` (1–200), `target_text` (1–200), `frequency` (`DAILY` \| `EVERY_N_DAYS` \| `WEEKLY`), `interval_days` (2–365, required iff `EVERY_N_DAYS`, else null), `start_date`, `status` (`ACTIVE` \| `PAUSED` \| `ARCHIVED`), `created_at`, `updated_at` |
| `habit_pause` | `id`, `habit_id`, `from_date`, `to_date` (null while open; inclusive) |
| `check_in` | `id`, `habit_id`, `period_start`, `color` (`RED` \| `YELLOW` \| `GREEN`), `note` (≤ 500, nullable), `updated_at`; unique `(habit_id, period_start)` |

Spring Session JDBC tables come from the session schema migration.

## Domain rules

All dates are computed in the user's `timezone`; "today" = `LocalDate.now(userZone)`.

### Periods

- `DAILY` — every date from `start_date` is a period.
- `EVERY_N_DAYS` — periods start at `start_date + k·N` (k ≥ 0) and last N days; the cell is the start date.
- `WEEKLY` — Monday–Sunday weeks; first period is the week containing `start_date`; the cell is the Monday.
- A period has **ended** when its last day is before today.
- A period is **paused** if its start date lies inside a `habit_pause` range.

### Cell states

`GREEN`, `YELLOW`, `RED` (from a check-in) or, without a check-in:
- `PAUSED` — period is paused;
- `PENDING` — period has not ended yet (current period, unmarked);
- `GREY` — period has ended, unmarked (unknown; never auto-RED);
- `NOT_DUE` — date is not a period start (every-N-days only) or before `start_date`.

### Editing window

A check-in for `period_start` may be set or cleared only if:
- `period_start` is a valid period start for the habit and is not before `start_date`;
- the period has started (`period_start ≤ today`);
- the period's last day ≥ `today − 7 days`;
- the period is not paused and the habit is not `ARCHIVED`.

Otherwise the API returns 422.

### Streaks (per habit)

Walk periods in order, skipping `PAUSED` ones:
- `GREEN` or `YELLOW` → streak + 1;
- `RED` or `GREY` → streak resets to 0;
- the current `PENDING` period is ignored (doesn't break the streak); a marked current period counts.

`current` = streak at the latest period; `best` = maximum ever.

### Daily combined score (month overview)

For each date: average over habits whose period *covers* that date and is not paused/not-due, with
`GREEN = 2`, `YELLOW = 1`, `RED = 0`, `GREY = 0`; `PENDING` excluded. Weekly/every-N habits contribute their
period's color to every day the period covers. Result is 0–2 (null if no habit contributes); the UI maps it to a color scale.

### Distribution

Over a week or month: counts and percentages of `GREEN`, `YELLOW`, `RED`, `GREY` periods whose `period_start`
falls in the range (paused, pending and not-due excluded).

## API

Errors are problem-details JSON. Every POST/PUT/DELETE needs the `X-XSRF-TOKEN` header (value of the `XSRF-TOKEN`
cookie, obtained via `GET /api/auth/csrf`).

### Public

- `GET /api/public/health` → `{"status":"UP"}` (no DB call).

### Auth (`/api/auth`)

- `GET /csrf`
- `POST /signup` `{username, password (≥ 8), timezone}` → 201, logged in. 409 if username taken; 400 if invalid timezone.
- `POST /login` `{username, password}`; 10 failed attempts per username or IP within 15 min → 429.
- `POST /logout`
- `GET /me` → `{username, timezone}`
- `PUT /me` `{timezone?, currentPassword?, newPassword?}` (password change requires `currentPassword`)

### Habits (`/api/habits`, authenticated, owner-only — others' ids → 404)

- `GET ?status=ACTIVE|PAUSED|ARCHIVED` (default: ACTIVE + PAUSED)
- `POST` `{name, minText, targetText, frequency, intervalDays?, startDate?}` (`startDate` defaults to today, may not be in the future)
- `PUT /{id}` `{name, minText, targetText}` — frequency/interval/start date are immutable
- `POST /{id}/pause` (opens a pause from today), `POST /{id}/resume` (closes it yesterday, or deletes it if opened today)
- `POST /{id}/archive`, `POST /{id}/unarchive`
- `PUT /{id}/check-ins/{periodStart}` `{color, note?}` → 200; `DELETE /{id}/check-ins/{periodStart}` → 204

### Stats (`/api/stats`, authenticated)

- `GET /week?start=YYYY-MM-DD` (Monday; defaults to the current week) →
  `{start, habits:[{id, name, minText, targetText, frequency, cells:[{date, periodStart, state, editable, note}]}], distribution}`.
  Weekly habits return one cell spanning the week.
- `GET /month?month=YYYY-MM` (defaults to current) →
  `{month, overview:[{date, score}], habits:[{id, name, cells:[{date, state}]}], distribution}`
- `GET /streaks` → `[{habitId, name, current, best}]`

Stats include `ACTIVE` and `PAUSED` habits; archived habits are excluded.

## Web

- `/login`, `/signup` (timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone`).
- `/` **Week** — streak list and week distribution bar at the top; week grid (habits × Mon–Sun) with prev/next
  week navigation. Tapping an editable cell opens a picker showing the habit's min/target text with
  RED / YELLOW / GREEN / Clear and an optional note.
- `/month` — combined daily score heatmap (calendar layout), per-habit calendar heatmaps, month distribution;
  prev/next month navigation.
- `/habits` — list with create/edit form, pause/resume, archive/unarchive; archived section collapsed.
- `/settings` — timezone and password.
- Unauthenticated users are redirected to `/login`. Charts are hand-built with CSS grid / SVG (no chart library).

Colors: GREEN, YELLOW, RED as named; GREY neutral grey; PENDING outlined; PAUSED hatched; NOT_DUE blank.

## Testing

- **Unit:** period generation, cell states, editing window, streaks, score and distribution (pure functions in `stats`).
- **Integration:** Testcontainers Postgres, one test class per controller (auth incl. rate limit and CSRF, habits
  incl. ownership, check-ins incl. window rules, stats).
- **Web:** Vitest + Testing Library for the grid, picker, heatmaps and forms.
- **E2E:** one Playwright flow: sign up → create habit → mark today GREEN → see it on week and month pages.

## Out of scope

Monthly frequency, numeric targets, reminders/notifications, social features, OAuth, data export.
