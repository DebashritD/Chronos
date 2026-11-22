# Chronos

A multi-user habit tracker built on the "no red" principle. Every period of a habit is marked
**RED** (did nothing), **YELLOW** (did the bare minimum) or **GREEN** (hit the target); unmarked past periods show grey.
Week and month views show the grid, streaks, a daily score heatmap and the color distribution.

## Backend API (`api/`)

Spring Boot 4 (Java 21) + Postgres. Requires JDK 21 and Docker.

```bash
cd api
docker compose up -d                       # local Postgres 17 on :5433
cp .env.example .env
set -a && . ./.env && set +a
./gradlew bootRun                          # http://localhost:8080
```

- Anyone can sign up (`POST /api/auth/signup`); each user only sees their own habits.
- For every POST/PUT/DELETE, call `GET /api/auth/csrf` first, then send the `XSRF-TOKEN` cookie value as the `X-XSRF-TOKEN` header.
- 10 failed logins per username or per IP within 15 minutes → 429 until the window passes.
- "Today" is computed in the user's timezone (captured at sign-up, changeable via `PUT /api/auth/me`).
- Check-ins can be set or cleared only for periods ending within the last 7 days, and not while paused or archived.
- `GET /api/public/health` returns `{"status":"UP"}` (liveness probe, no database call).
- Code layout (`com.chronos`): `core` (`auth`, `user`, `config`, `error`, `web`), `habit` (habits, pauses, check-ins),
  `habit.domain` (pure period/streak/score logic), `stats` (week, month and streak views).

| Endpoint | Purpose |
|---|---|
| `GET /api/auth/csrf` · `POST /api/auth/signup` · `POST /api/auth/login` · `POST /api/auth/logout` | Session auth |
| `GET` / `PUT /api/auth/me` | Username + timezone; change timezone or password |
| `GET /api/habits[?status=]` · `POST /api/habits` · `PUT /api/habits/{id}` | Habits |
| `POST /api/habits/{id}/pause` · `resume` · `archive` · `unarchive` | Lifecycle |
| `PUT` / `DELETE /api/habits/{id}/check-ins/{periodStart}` | Mark a period RED / YELLOW / GREEN |
| `GET /api/stats/week?start=` · `/month?month=` · `/streaks` | Views |

Tests (Testcontainers starts its own Postgres):

```bash
cd api && ./gradlew test
```

With Rancher Desktop, export these first:

```bash
export DOCKER_HOST=unix://$HOME/.rd/docker.sock
export TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock
```

Backend environment variables: `DATABASE_URL` (JDBC URL), `DATABASE_USER`, `DATABASE_PASSWORD`,
`COOKIE_SECURE` (default `true`), `PORT` (default `8080`).

## Frontend (`web/`)

Vite + React 19 + TypeScript, TanStack Query, react-router, Tailwind CSS 4, lucide-react icons, Inter
(self-hosted via @fontsource). Dark theme only. Requires Node 22+.

```bash
cd web
npm install
npm run dev        # http://localhost:5173, proxies /api to the backend on :8080 (set API_PORT to override)
npm test           # Vitest unit/component tests
npm run lint       # oxlint
npm run build      # type-check + production build into web/dist
npm run e2e        # Playwright (needs the backend running; signs up a fresh user each run)
```

Pages: **Today** (`/`, one-tap marking with a time-left countdown), **Progress** (`/progress`, Week grid + picker,
distribution, streaks; `?view=month` for the Month heatmaps), **Habits** (`/habits`), **Account** (`/settings`).
Phones get a bottom tab bar, wider screens a sidebar. Static mockups:
`docs/superpowers/specs/2026-11-22-chronos-ui-mockups.html`.

## Deployment (one Docker service)

The root `Dockerfile` builds the web app, copies it into the API's `static/` folder and produces a single image.
Spring Boot serves the site and the API from the same origin, so the session cookie needs no CORS: client routes such
as `/progress` fall back to `index.html`, `/assets/*` is cached for a year, and `/api/**` is untouched.

```bash
docker build -t chronos .
docker run --rm -p 8090:8080 -e DATABASE_URL=jdbc:postgresql://host.docker.internal:5433/chronos \
  -e DATABASE_USER=chronos -e DATABASE_PASSWORD=chronos -e COOKIE_SECURE=false chronos   # http://localhost:8090
```

Hosting: Render (free web service, Docker runtime) + Neon (free Postgres; give Chronos its own project/database).

1. In Neon, create a database and copy the **direct** (non-pooler) connection string; convert it to
   `DATABASE_URL=jdbc:postgresql://<host>/<db>?sslmode=require`, `DATABASE_USER`, `DATABASE_PASSWORD`.
2. In Render, **New → Blueprint** and pick this repo; `render.yaml` defines the service (Singapore, health check
   `/api/public/health`) and prompts for the three variables above. Flyway creates the schema on first start.
3. Every push to `main` redeploys. The free plan sleeps after 15 minutes idle; the first request then takes ~30–60 s
   (the app shows a "waking up" notice).
