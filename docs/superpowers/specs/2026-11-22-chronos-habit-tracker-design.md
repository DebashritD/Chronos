# Chronos — No-Red Habit Tracker: Design

## Goal

A multi-user web app for tracking habits by the "no-red" principle. Each user defines habits with a frequency,
a bare-minimum (YELLOW) and a target (GREEN), marks each period RED / YELLOW / GREEN, and sees week and month
infographics plus streaks.

Reference project: `../Dionysus` (same stack, deployment and testing setup; not its single-owner auth).

## Stack and layout

- `api/` — Spring Boot 4.1 (Java 21), `spring-boot-starter-webmvc`, `-security`, `-jdbc`, `-flyway`,
  `-session-jdbc`, `-validation`; Postgres 17 (`docker-compose.yml` for local, host port 5433). Package `com.chronos`:
  - `core` — `auth`, `user`, `config`, `error`, `web`
  - `habit` — habits, pauses, check-ins
  - `habit.domain` — pure period computation, cell states, streaks, scores (no Spring)
  - `stats` — week/month views, streaks
- `web/` — Vite + React 19 + TypeScript, TanStack Query, react-router, Tailwind 4, `lucide-react` icons, Inter
  (`@fontsource/inter`, self-hosted). `npm run dev` proxies `/api` to `:8080`.
- Root `Dockerfile` builds the web app into the API's static resources and runs one jar (same origin, so the session
  cookie just works). `render.yaml` deploys one Docker web service (Render free plan) with health check `/api/public/health`;
  the database is Neon free Postgres (a database of its own, not shared with Dionysus).
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
- `period_start` is a valid period start for the habit and is not before its first period start
  (for `WEEKLY`, the Monday of the week containing `start_date`);
- the period has started (`period_start ≤ today`);
- the period's last day ≥ `today − 7 days`;
- the period is not paused and the habit is not `ARCHIVED`.

Otherwise the API returns 422.

The web app's countdown ("time left to mark", see Web) counts down to the end of the current period. When it runs
out the period has ended and shows as unmarked (GREY) if nothing was set; it can still be marked or changed for 7 more
days under the rules above. The countdown is a nudge, not a lock.

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

Over a week or month: counts (plus `total`; the UI derives percentages) of `GREEN`, `YELLOW`, `RED`, `GREY` periods whose `period_start`
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
- `POST /{id}/archive` (opens a pause from today if none is open), `POST /{id}/unarchive` (closes it as in resume;
  status becomes `ACTIVE`), so archived time shows as `PAUSED`
- `PUT /{id}/check-ins/{periodStart}` `{color, note?}` → 200; `DELETE /{id}/check-ins/{periodStart}` → 204

### Stats (`/api/stats`, authenticated)

- `GET /week?start=YYYY-MM-DD` (Monday; defaults to the current week) →
  `{start, today, habits:[{id, name, minText, targetText, frequency, intervalDays, cells:[{date, periodStart, state, editable, note, closesAt}]}], distribution}`.
  Weekly habits return one cell spanning the week. Non-due days of `DAILY`/`EVERY_N_DAYS` habits are `NOT_DUE` cells
  with `periodStart`, `note` and `closesAt` all `null` and `editable: false`.
  `closesAt` is an ISO-8601 UTC instant (e.g. `"2026-11-18T18:30:00Z"`): 00:00 in the user's timezone on the day after
  the period's last day (`periodEnd + 1 day`), i.e. when the period stops being current. It is set whenever `periodStart`
  is set (including paused and past periods) and `null` otherwise.
- `GET /month?month=YYYY-MM` (defaults to current) →
  `{month, overview:[{date, score}], habits:[{id, name, frequency, cells:[{date, state}]}], distribution}`.
  Per-habit cells: `DAILY`/`EVERY_N_DAYS` show the state on due days and `NOT_DUE` otherwise; `WEEKLY` shows the
  week's state on every day of that week.
- `GET /streaks` → `[{habitId, name, current, best}]`

Stats include `ACTIVE` and `PAUSED` habits; archived habits are excluded.

## Web

UI v2 ("native app" feel, dark only). Mockups: `docs/superpowers/specs/2026-11-22-chronos-ui-mockups.html`.

### Shell and navigation

- Mobile (< 768 px): content plus a bottom tab bar with icons: **Today** (`/`), **Progress** (`/progress`),
  **Habits** (`/habits`), **Account** (`/settings`).
- Desktop: a left sidebar with the logo tile + "Chronos", the same four items, and a user chip at the bottom
  (avatar initial, username, timezone). No top bar and no header "Log out" (logout lives on Account).
- `/login`, `/signup`: logo tile, headline "Never two reds in a row.", short tagline, the form, and a link to the other
  page. Sign-up takes the timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- Unauthenticated users are redirected to `/login`. `/month` and the old Week home no longer exist (never shipped);
  the month view is `/progress?view=month`.

### Today (`/`)

- Eyebrow date ("Wednesday, 18 Nov", from the week response's `today`), title "Today".
- Hero card: progress ring "N/M DONE" and a short encouragement line. M = habits whose current period is open and
  editable today (not paused, due); N = those of them already marked.
- One card per such habit: name, min/target text (every-N-days: "Every 3 days · …", weekly: "This week · …"),
  a flame with the current streak (grey at 0), a countdown chip, and three one-tap buttons **Target** (GREEN),
  **Minimum** (YELLOW), **Missed** (RED). The selected one is filled (`aria-pressed`). Tapping a button saves the
  check-in immediately (`PUT`, keeping any existing note); tapping the already-selected one does nothing. Tapping the
  habit name opens the picker sheet (GREEN / YELLOW / RED, "Note (optional)", Clear / Cancel / Save); clearing is only
  possible there. Daily habits also show a 7-segment strip of this week's cells.
- Data: the current `GET /api/stats/week` and `GET /api/stats/streaks`. A habit's today-cell is the cell whose `date`
  is `today` (weekly habits: their single cell). Habits whose today-cell is not editable (paused, not due) are left
  out, so an every-N-days habit appears on its due day (the period's first day). After a mark, the stats queries refetch.
- Countdown chip (clock icon), from `closesAt − now`, refreshed every minute:
  daily "14h left today", every-N-days "1d 14h left in this period", weekly "4d 14h left this week"
  (days are dropped when 0). Under 3 hours: "2h 40m left" in the urgent orange style; under 1 hour: "40m left".
  Once the period is marked the chip is green (still showing the time). Hidden once `closesAt` has passed.
- Desktop: the cards sit in a 2-column grid beside a "This week" grid card and the Streaks card.
- No habits: a link to create the first one.

### Progress (`/progress`)

- Segmented control **Week | Month** (`?view=month` selects Month; Week is the default).
- Week: prev/next week (`?start=YYYY-MM-DD`) and "This week". Grid of habits × Mon–Sun with rounded squircle cells;
  today's day header is an accent circle and today's cell has an accent ring; weekly habits span all 7 columns;
  every-N-days rows note "every N days", paused rows "paused". Tapping an editable cell opens the picker sheet. Below:
  a "This week" card with a donut of the distribution and a legend with counts (Green, Yellow, Red, Unmarked), and
  a Streaks card (current with flame, best).
- Month: prev/next month (`?month=YYYY-MM`) and "This month". "Daily score" calendar heatmap (Monday first, day
  numbers, today ringed, future/no-score days neutral) with a five-step red → green legend; a "By habit" card with a
  compact per-habit heatmap; the month distribution donut.

### Habits (`/habits`)

- List rows: name and a summary "Daily · 5 → 20 pages" (min → target), actions Edit, Pause/Resume, Archive;
  paused rows dimmed with a "Paused" pill; archived habits in a collapsed "Archived" section with Unarchive.
- Create via "New habit" (a floating + button on mobile); the form has name, minimum, target, frequency,
  interval (every-N-days only) and optional start date. Edit changes texts only.

### Account (`/settings`)

- Username, timezone (with "Use this device") and password change, and **Log out**.

### Visual system

- Dark only, Inter. Colours (CSS custom properties via Tailwind `@theme`): background `#0a0a0f`, card `#15151d`,
  raised card `#1c1c26`, hairline `rgba(255,255,255,.06)`, text `#f4f4f7`, secondary `#8e8e9a`, dim `#5a5a66`,
  accent `#7c8cff`, GREEN `#30d158`, YELLOW `#ffd60a`, RED `#ff453a`, GREY/unmarked `#2c2c36`, urgent `#ff9f0a`.
  Score scale (red → green): `#ff453a`, `#ff8a3d`, `#ffd60a`, `#7ed957`, `#30d158`.
- Cards 22 px radius, cells 10 px. PENDING cells outlined, PAUSED hatched, NOT_DUE blank.
- Icons from `lucide-react`. Transitions are disabled under `prefers-reduced-motion: reduce`.
- Charts (ring, donut, heatmaps) are hand-built with CSS grid / SVG (no chart library).

## Testing

- **Unit:** period generation, cell states, editing window, streaks, score and distribution (pure functions in `habit.domain`).
- **Integration:** Testcontainers Postgres, one test class per controller (auth incl. rate limit and CSRF, habits
  incl. ownership, check-ins incl. window rules, stats).
- **Web:** Vitest + Testing Library for the Today cards, countdown formatter, grid, picker, heatmaps and forms.
- **E2E:** one Playwright flow: sign up → create habit → tap "Target" on Today → see it on Progress week and month.

## Out of scope

Monthly frequency, numeric targets, reminders/notifications, light theme, social features, OAuth, data export.
