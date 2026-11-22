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
