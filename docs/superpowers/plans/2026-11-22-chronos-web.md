# Chronos Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Chronos web app (sign up / log in, habits, week grid with RED/YELLOW/GREEN picker, month heatmaps, streaks, settings) and ship it with the API as one Docker image on Render + Neon.

**Architecture:** Vite + React SPA in `web/` mirroring `../Dionysus/web`: a tiny `fetch` client with SPA CSRF handling, TanStack Query for server state, react-router routes guarded by a session context. All stats come pre-computed from `/api/stats/*`; the web app only renders them (hand-made CSS grids, no chart library). The root `Dockerfile` bakes the built app into the Spring Boot jar.

**Tech Stack:** Node ≥ 22, Vite 8, React 19, TypeScript ~7, TanStack Query 5, react-router 8, Tailwind CSS 4, Vitest + Testing Library + jsdom, Playwright, oxlint.

**Spec:** `docs/superpowers/specs/2026-11-22-chronos-habit-tracker-design.md`
**Depends on:** `docs/superpowers/plans/2026-11-22-chronos-backend-api.md` (fully implemented; its JSON shapes are restated below).

## Global Constraints

- Dependency versions are copied from `../Dionysus/web/package.json` (React `^19.3.1`, react-router `^8.5.2`, TanStack Query `^5.108.0`, Vite `^8.3.6`, Vitest `^5.1.1`, TypeScript `~7.0.2`, Tailwind `^4.3.5`, Playwright `^1.65.1`, oxlint `^1.90.0`). Add no other runtime dependencies besides `@fontsource-variable/manrope`.
- Dates travel as ISO strings (`YYYY-MM-DD`, months `YYYY-MM`) and are never converted to local `Date`s for logic; date math uses UTC (`src/lib/dates.ts`).
- Week starts Monday. The API decides "today" and editability; the UI never re-derives them.
- Colors: GREEN, YELLOW, RED as named; GREY neutral grey; PENDING outlined; PAUSED hatched; NOT_DUE blank.
- Every POST/PUT/DELETE goes through `api` in `src/api/client.ts` (adds the `X-XSRF-TOKEN` header).
- User-facing error text always comes from `messageFor(error)`.
- Verification commands (run in `web/`): `npm test`, `npm run lint`, `npm run build`.
- Every commit ends with the trailer `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.
- Production: Render (free Docker web service, region Singapore) + Neon (free Postgres, a database of its own).

### API shapes used by the web app

```ts
// GET/PUT /api/auth/me, POST /api/auth/login|signup
type Me = { username: string; timezone: string }
// /api/habits
type Habit = { id: number; name: string; minText: string; targetText: string;
  frequency: 'DAILY' | 'EVERY_N_DAYS' | 'WEEKLY'; intervalDays?: number; startDate: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' }
// GET /api/stats/week?start=
type WeekView = { start: string; today: string; distribution: Distribution; habits: { id: number; name: string; minText: string;
  targetText: string; frequency: Frequency; cells: { date: string; periodStart: string | null; state: CellState;
  editable: boolean; note: string | null }[] }[] }
// GET /api/stats/month?month=
type MonthView = { month: string; distribution: Distribution; overview: { date: string; score: number | null }[];
  habits: { id: number; name: string; frequency: Frequency; cells: { date: string; state: CellState }[] }[] }
// GET /api/stats/streaks
type Streak = { habitId: number; name: string; current: number; best: number }
type Distribution = { green: number; yellow: number; red: number; grey: number; total: number }
type CellState = 'GREEN' | 'YELLOW' | 'RED' | 'PAUSED' | 'PENDING' | 'GREY' | 'NOT_DUE'
```
Errors are `application/problem+json` with `code` ∈ `VALIDATION`, `BAD_CREDENTIALS`, `NOT_FOUND`, `USERNAME_TAKEN`, `INVALID_STATE`, `CONFLICT`, `CHECK_IN_NOT_ALLOWED`, `TOO_MANY_ATTEMPTS`.

---

### Task 1: Scaffold, API client and date helpers

**Files:**
- Create: `web/package.json`, `web/index.html`, `web/public/favicon.svg`, `web/src/main.tsx`, `web/src/App.tsx`, `web/src/index.css`
- Copy from `../Dionysus/web`: `.gitignore`, `.oxlintrc.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `playwright.config.ts`, `src/api/{client,client.test,pending,queryClient,queryErrorBridge}.ts`, `src/app/{WakingNotice,WakingNotice.test}.tsx`
- Create: `web/src/api/{errors,types}.ts`, `web/src/lib/{dates,cells}.ts`, `web/src/test/{setup,http}.ts`
- Test: `web/src/api/errors.test.ts`, `web/src/lib/dates.test.ts`

**Interfaces:**
- Produces:
  - `api.get<T>(path, params?)`, `api.post<T>(path, body?)`, `api.put<T>(path, body)`, `api.del(path)`, `clearCsrf()` (copied client)
  - `ApiError { status; code; detail }`, `messageFor(error: unknown): string`
  - `createQueryClient(queryDefaults?)`, `setQueryErrorHandler(handler | null)`
  - Types in `src/api/types.ts`: `Me`, `Frequency`, `HabitStatus`, `Habit`, `NewHabit`, `HabitTexts`, `Color`, `CellState`, `Distribution`, `WeekView`, `WeekHabit`, `WeekCell`, `MonthView`, `MonthHabit`, `Streak`
  - `src/lib/dates.ts`: `addDays(iso, n)`, `addMonths(ym, n)`, `weekdayIndex(iso)` (Mon = 0), `dayOfMonth(iso)`, `formatDay(iso)` (`"Wed 18 Nov"`), `formatWeekRange(start)` (`"16 – 22 Nov 2026"`), `formatMonth(ym)` (`"November 2026"`), `WEEKDAYS` (`['Mon', …, 'Sun']`)
  - `src/lib/cells.ts`: `cellClass(state)`, `STATE_LABEL: Record<CellState, string>`, `frequencyLabel(frequency, intervalDays?)`
  - `src/test/http.ts`: `jsonResponse(body, status?)`, `problemResponse(status, code, detail?)`, `stubApi(handler)` returning the `fetch` mock, `requests(fetchMock)` returning `{ method, url, body }[]` (excluding `/api/auth/csrf`)

- [ ] **Step 1: Copy the tooling and the generic API layer**

Run (from the repo root):
```bash
mkdir -p web/src/api web/src/app web/src/lib web/src/test web/public web/e2e
cp ../Dionysus/web/{.gitignore,.oxlintrc.json,tsconfig.json,tsconfig.app.json,tsconfig.node.json,vite.config.ts,playwright.config.ts} web/
cp ../Dionysus/web/src/api/{client.ts,client.test.ts,pending.ts,queryClient.ts,queryErrorBridge.ts} web/src/api/
cp ../Dionysus/web/src/app/{WakingNotice.tsx,WakingNotice.test.tsx} web/src/app/
```

These files are app-agnostic: `vite.config.ts` proxies `/api` to `:8080` and runs Vitest in jsdom with `src/test/setup.ts`; `playwright.config.ts` runs one phone-sized Chromium project against `npm run dev`.

- [ ] **Step 2: Create `package.json`, `index.html`, favicon and styles**

`web/package.json`:
```json
{
  "name": "web",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "oxlint",
    "preview": "vite preview",
    "test": "vitest run",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@fontsource-variable/manrope": "^5.3.0",
    "@tanstack/react-query": "^5.108.0",
    "react": "^19.3.1",
    "react-dom": "^19.3.1",
    "react-router": "^8.5.2"
  },
  "devDependencies": {
    "@playwright/test": "^1.65.1",
    "@tailwindcss/vite": "^4.3.5",
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.12",
    "@types/node": "^24.19.2",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.1.2",
    "jsdom": "^31.0.1",
    "oxlint": "^1.90.0",
    "tailwindcss": "^4.3.5",
    "typescript": "~7.0.2",
    "vite": "^8.3.6",
    "vitest": "^5.1.1"
  }
}
```

`web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0b0d17" />
    <title>Chronos</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`web/public/favicon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="12" fill="#0b0d17"/>
  <rect x="12" y="24" width="12" height="16" rx="3" fill="#ef4444"/>
  <rect x="26" y="24" width="12" height="16" rx="3" fill="#eab308"/>
  <rect x="40" y="24" width="12" height="16" rx="3" fill="#22c55e"/>
</svg>
```

`web/src/index.css`:
```css
@import "tailwindcss";

@theme {
  --color-bg: #0b0d17;
  --color-surface: #151a2e;
  --color-muted: #9aa0b8;
  --color-accent: #8b9cff;
  --color-cell-green: #22c55e;
  --color-cell-yellow: #eab308;
  --color-cell-red: #ef4444;
  --color-cell-grey: #4b5163;
  --font-sans: 'Manrope Variable', ui-sans-serif, system-ui, sans-serif;
}

body {
  background-color: var(--color-bg);
  color: var(--color-muted);
}

/* PAUSED cells: diagonal hatching */
.cell-paused {
  background-image: repeating-linear-gradient(45deg, rgb(154 160 184 / 0.35) 0 2px, transparent 2px 6px);
}
```

`web/src/App.tsx` (replaced by the router in Task 2):
```tsx
function App() {
  return <h1 className="p-4 text-xl font-semibold text-accent">Chronos</h1>
}

export default App
```

`web/src/main.tsx` (Task 2 adds the `SessionProvider`):
```tsx
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.tsx'
import { createQueryClient } from './api/queryClient'
import '@fontsource-variable/manrope'
import './index.css'

const queryClient = createQueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
```

Run: `cd web && npm install`
Expected: creates `package-lock.json` and `node_modules/` without errors.

- [ ] **Step 3: Create test setup and HTTP helpers**

`web/src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  localStorage.clear()
})
```

`web/src/test/http.ts`:
```ts
import { vi, type Mock } from 'vitest'

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

export function problemResponse(status: number, code: string, detail?: string): Response {
  return new Response(JSON.stringify({ code, detail }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  })
}

export interface ApiRequest {
  method: string
  url: string
  body: unknown
}

type Handler = (request: ApiRequest) => Response | undefined

/**
 * Stubs `fetch` with `handler` (unmatched requests get a 404) and sets an XSRF cookie so
 * writes don't need the `/api/auth/csrf` round trip.
 */
export function stubApi(handler: Handler): Mock {
  document.cookie = 'XSRF-TOKEN=test-token; path=/'
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined
    return handler({ method, url, body }) ?? new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** The requests a `stubApi` mock received, in order. */
export function requests(fetchMock: Mock): ApiRequest[] {
  return fetchMock.mock.calls
    .map(([input, init]) => ({
      method: (init as RequestInit | undefined)?.method ?? 'GET',
      url: String(input),
      body:
        typeof (init as RequestInit | undefined)?.body === 'string'
          ? (JSON.parse((init as RequestInit).body as string) as unknown)
          : undefined,
    }))
    .filter((r) => r.url !== '/api/auth/csrf')
}
```

- [ ] **Step 4: Write failing tests for errors and dates**

`web/src/api/errors.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { ApiError, messageFor } from './errors'

describe('messageFor', () => {
  it('uses the server detail for validation errors', () => {
    expect(messageFor(new ApiError(400, 'VALIDATION', 'name: must not be blank'))).toBe('name: must not be blank')
  })

  it('maps known codes to friendly copy', () => {
    expect(messageFor(new ApiError(409, 'USERNAME_TAKEN', null))).toBe('That username is taken')
    expect(messageFor(new ApiError(422, 'CHECK_IN_NOT_ALLOWED', null))).toBe(
      'That period can no longer be changed',
    )
  })

  it('falls back for unknown errors', () => {
    expect(messageFor(new Error('boom'))).toBe('Something went wrong')
    expect(messageFor(new ApiError(500, null, null))).toBe('Something went wrong')
  })
})
```

`web/src/lib/dates.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { addDays, addMonths, dayOfMonth, formatDay, formatMonth, formatWeekRange, weekdayIndex } from './dates'

describe('dates', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04')
    expect(addDays('2026-11-16', -7)).toBe('2026-11-09')
  })

  it('adds months', () => {
    expect(addMonths('2026-11', 1)).toBe('2026-12')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })

  it('numbers weekdays from Monday', () => {
    expect(weekdayIndex('2026-11-16')).toBe(0)
    expect(weekdayIndex('2026-11-22')).toBe(6)
    expect(weekdayIndex('2026-11-01')).toBe(6)
  })

  it('formats for display', () => {
    expect(dayOfMonth('2026-11-08')).toBe(8)
    expect(formatDay('2026-11-18')).toBe('Wed 18 Nov')
    expect(formatWeekRange('2026-11-16')).toBe('16 – 22 Nov 2026')
    expect(formatWeekRange('2026-11-30')).toBe('30 Nov – 6 Dec 2026')
    expect(formatMonth('2026-11')).toBe('November 2026')
  })
})
```

- [ ] **Step 5: Run them to verify they fail**

Run: `cd web && npm test`
Expected: FAIL — `./errors` and `./dates` cannot be resolved (the copied `client.test.ts` also fails until `errors.ts` exists).

- [ ] **Step 6: Implement errors, types, dates and cells**

`web/src/api/errors.ts`:
```ts
/** Error thrown by the API client for non-2xx responses; `code`/`detail` come from the problem JSON body. */
export class ApiError extends Error {
  status: number
  code: string | null
  detail: string | null

  constructor(status: number, code: string | null, detail: string | null) {
    super(detail ?? `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.detail = detail
  }
}

const MESSAGES_BY_CODE: Record<string, string> = {
  BAD_CREDENTIALS: 'Wrong username or password',
  TOO_MANY_ATTEMPTS: 'Too many attempts, try again later',
  USERNAME_TAKEN: 'That username is taken',
  INVALID_STATE: "That action isn't available for this habit right now",
  CHECK_IN_NOT_ALLOWED: 'That period can no longer be changed',
  NOT_FOUND: 'Not found',
}

const FALLBACK_MESSAGE = 'Something went wrong'

/** Maps an error (typically an `ApiError`) to user-facing copy. */
export function messageFor(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return FALLBACK_MESSAGE
  }
  if (error.code === 'VALIDATION') {
    return error.detail ?? FALLBACK_MESSAGE
  }
  if (error.code && error.code in MESSAGES_BY_CODE) {
    return MESSAGES_BY_CODE[error.code]
  }
  return FALLBACK_MESSAGE
}
```

`web/src/api/types.ts`:
```ts
export interface Me {
  username: string
  timezone: string
}

export type Frequency = 'DAILY' | 'EVERY_N_DAYS' | 'WEEKLY'
export type HabitStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
export type Color = 'GREEN' | 'YELLOW' | 'RED'
export type CellState = Color | 'PAUSED' | 'PENDING' | 'GREY' | 'NOT_DUE'

export interface HabitTexts {
  name: string
  minText: string
  targetText: string
}

export interface NewHabit extends HabitTexts {
  frequency: Frequency
  intervalDays?: number
  startDate?: string
}

export interface Habit extends HabitTexts {
  id: number
  frequency: Frequency
  intervalDays?: number
  startDate: string
  status: HabitStatus
}

export interface Distribution {
  green: number
  yellow: number
  red: number
  grey: number
  total: number
}

export interface WeekCell {
  date: string
  periodStart: string | null
  state: CellState
  editable: boolean
  note: string | null
}

export interface WeekHabit extends HabitTexts {
  id: number
  frequency: Frequency
  cells: WeekCell[]
}

export interface WeekView {
  start: string
  today: string
  habits: WeekHabit[]
  distribution: Distribution
}

export interface MonthHabit {
  id: number
  name: string
  frequency: Frequency
  cells: { date: string; state: CellState }[]
}

export interface MonthView {
  month: string
  overview: { date: string; score: number | null }[]
  habits: MonthHabit[]
  distribution: Distribution
}

export interface Streak {
  habitId: number
  name: string
  current: number
  best: number
}
```

`web/src/lib/dates.ts`:
```ts
/** Date helpers on ISO strings ("YYYY-MM-DD" / "YYYY-MM"). All math is in UTC so the browser timezone never matters. */

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

function parse(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  const date = parse(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return format(date)
}

export function addMonths(yearMonth: string, months: number): string {
  const date = parse(`${yearMonth}-01`)
  date.setUTCMonth(date.getUTCMonth() + months)
  return format(date).slice(0, 7)
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(iso: string): number {
  return (parse(iso).getUTCDay() + 6) % 7
}

export function dayOfMonth(iso: string): number {
  return parse(iso).getUTCDate()
}

const dayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
const dayMonthFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })
const monthFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })

/** "Wed 18 Nov" */
export function formatDay(iso: string): string {
  return dayFormat.format(parse(iso)).replace(',', '')
}

/** "16 – 22 Nov 2026", or "30 Nov – 6 Dec 2026" across months. */
export function formatWeekRange(start: string): string {
  const end = addDays(start, 6)
  const year = end.slice(0, 4)
  const endText = dayMonthFormat.format(parse(end))
  const startText = start.slice(5, 7) === end.slice(5, 7) ? String(dayOfMonth(start)) : dayMonthFormat.format(parse(start))
  return `${startText} – ${endText} ${year}`
}

/** "November 2026" */
export function formatMonth(yearMonth: string): string {
  return monthFormat.format(parse(`${yearMonth}-01`))
}
```

`web/src/lib/cells.ts`:
```ts
import type { CellState, Frequency } from '../api/types'

export const STATE_LABEL: Record<CellState, string> = {
  GREEN: 'Target hit',
  YELLOW: 'Minimum done',
  RED: 'Did nothing',
  PAUSED: 'Paused',
  PENDING: 'Not marked yet',
  GREY: 'Not marked',
  NOT_DUE: 'Not due',
}

/** Tailwind classes for a cell's fill (see the colors in index.css). */
export function cellClass(state: CellState): string {
  switch (state) {
    case 'GREEN':
      return 'bg-cell-green'
    case 'YELLOW':
      return 'bg-cell-yellow'
    case 'RED':
      return 'bg-cell-red'
    case 'GREY':
      return 'bg-cell-grey'
    case 'PENDING':
      return 'border border-muted/60'
    case 'PAUSED':
      return 'cell-paused bg-surface'
    case 'NOT_DUE':
      return 'bg-transparent'
  }
}

export function frequencyLabel(frequency: Frequency, intervalDays?: number): string {
  switch (frequency) {
    case 'DAILY':
      return 'Daily'
    case 'WEEKLY':
      return 'Weekly'
    case 'EVERY_N_DAYS':
      return `Every ${intervalDays} days`
  }
}
```

- [ ] **Step 7: Run tests, lint and build**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: all tests PASS (errors, dates, copied client and WakingNotice tests); lint has no errors; build writes `web/dist/`.

> If `formatDay` yields `"Wed, 18 Nov"` with a comma in another position, keep the `.replace(',', '')`; the test is the contract.

- [ ] **Step 8: Commit**

```bash
git add web
git commit -m "feat(web): scaffold Vite app with API client and date helpers" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Session, login, sign-up, guarded routes and app shell

**Files:**
- Create: `web/src/features/auth/{session,LoginPage,SignupPage}.tsx`, `web/src/app/{router,Shell,NotFound}.tsx`, `web/src/test/utils.tsx`
- Modify: `web/src/App.tsx`, `web/src/main.tsx`
- Test: `web/src/features/auth/{LoginPage,SignupPage}.test.tsx`, `web/src/app/router.test.tsx`

**Interfaces:**
- Consumes: `api`, `clearCsrf`, `ApiError`, `messageFor`, `setQueryErrorHandler`, `createQueryClient`, `Me` (Task 1); `stubApi`, `jsonResponse`, `problemResponse`, `requests` (Task 1).
- Produces:
  - `SessionProvider({ children, initialMe? })` — without `initialMe` it calls `GET /api/auth/me` on mount; with it (tests) it skips the check.
  - `useSession(): { me: Me | null; checking: boolean; login(username, password); signup(username, password); logout(); setMe(me: Me) }`
  - `browserTimezone(): string`
  - `AppRouter` with routes `/login`, `/signup` (guests only) and, inside `Shell` (signed-in only), `/` plus a `*` NotFound. Later tasks add `/habits` (Task 3), replace `/` (Task 4), add `/month` (Task 5) and `/settings` (Task 6).
  - Tests: `renderWithProviders(ui, { route?, path?, me? })` → `{ user, queryClient, ...render result }`; `me` defaults to `BOB` (`{ username: 'bob', timezone: 'Asia/Kolkata' }`), `null` = signed out, `'fetch'` = real `/api/auth/me` check. `path` defaults to the route's pathname; any other path renders `LocationDisplay` (`data-testid="location-display"`).

- [ ] **Step 1: Write the test utilities**

`web/src/test/utils.tsx`:
```tsx
import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { createQueryClient } from '../api/queryClient'
import type { Me } from '../api/types'
import { SessionProvider } from '../features/auth/session'

export const BOB: Me = { username: 'bob', timezone: 'Asia/Kolkata' }

/** Renders the current pathname + search so tests can assert on navigation. */
export function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location-display">{location.pathname + location.search}</div>
}

interface Options {
  route?: string
  path?: string
  me?: Me | null | 'fetch'
}

export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const { route = '/', me = BOB } = options
  const path = options.path ?? route.split('?')[0]
  const queryClient = createQueryClient({ retry: false })
  const user = userEvent.setup()

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <SessionProvider initialMe={me === 'fetch' ? undefined : me}>
          <Routes>
            <Route path={path} element={ui} />
            {path !== '*' && <Route path="*" element={<LocationDisplay />} />}
          </Routes>
        </SessionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )

  return { ...utils, queryClient, user }
}
```

- [ ] **Step 2: Write the failing tests**

`web/src/features/auth/LoginPage.test.tsx`:
```tsx
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { jsonResponse, problemResponse, requests, stubApi } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  it('logs in and goes to the week view', async () => {
    const fetchMock = stubApi(({ url }) =>
      url === '/api/auth/login' ? jsonResponse({ username: 'bob', timezone: 'Asia/Kolkata' }) : undefined,
    )
    const { user } = renderWithProviders(<LoginPage />, { route: '/login', me: null })

    await user.type(screen.getByLabelText('Username'), 'bob')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByTestId('location-display')).toHaveTextContent('/')
    expect(requests(fetchMock)).toEqual([
      { method: 'POST', url: '/api/auth/login', body: { username: 'bob', password: 'password123' } },
    ])
  })

  it('shows the error for wrong credentials', async () => {
    stubApi(() => problemResponse(401, 'BAD_CREDENTIALS'))
    const { user } = renderWithProviders(<LoginPage />, { route: '/login', me: null })

    await user.type(screen.getByLabelText('Username'), 'bob')
    await user.type(screen.getByLabelText('Password'), 'nope-nope')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong username or password')
  })

  it('links to sign-up', () => {
    stubApi(() => undefined)
    renderWithProviders(<LoginPage />, { route: '/login', me: null })

    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/signup')
  })
})
```

`web/src/features/auth/SignupPage.test.tsx`:
```tsx
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { jsonResponse, problemResponse, requests, stubApi } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { browserTimezone } from './session'
import { SignupPage } from './SignupPage'

describe('SignupPage', () => {
  it('creates the account with the browser timezone', async () => {
    const fetchMock = stubApi(({ url }) =>
      url === '/api/auth/signup' ? jsonResponse({ username: 'carol', timezone: browserTimezone() }, 201) : undefined,
    )
    const { user } = renderWithProviders(<SignupPage />, { route: '/signup', me: null })

    expect(screen.getByText(browserTimezone(), { exact: false })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Username'), 'carol')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(await screen.findByTestId('location-display')).toHaveTextContent('/')
    expect(requests(fetchMock)[0]).toEqual({
      method: 'POST',
      url: '/api/auth/signup',
      body: { username: 'carol', password: 'password123', timezone: browserTimezone() },
    })
  })

  it('explains a taken username', async () => {
    stubApi(() => problemResponse(409, 'USERNAME_TAKEN'))
    const { user } = renderWithProviders(<SignupPage />, { route: '/signup', me: null })

    await user.type(screen.getByLabelText('Username'), 'bob')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That username is taken')
  })
})
```

`web/src/app/router.test.tsx`:
```tsx
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { jsonResponse, problemResponse, requests, stubApi } from '../test/http'
import { renderWithProviders } from '../test/utils'
import { AppRouter } from './router'

describe('AppRouter', () => {
  it('sends signed-out visitors to the login page', async () => {
    stubApi(({ url }) => (url === '/api/auth/me' ? problemResponse(401, 'BAD_CREDENTIALS') : undefined))
    renderWithProviders(<AppRouter />, { route: '/', path: '/*', me: 'fetch' })

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  })

  it('shows the shell to signed-in users', async () => {
    stubApi(({ url }) => (url === '/api/auth/me' ? jsonResponse({ username: 'bob', timezone: 'UTC' }) : undefined))
    renderWithProviders(<AppRouter />, { route: '/', path: '/*', me: 'fetch' })

    expect(await screen.findByText('bob')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Habits' }).length).toBeGreaterThan(0)
  })

  it('keeps signed-in users away from the login page', async () => {
    stubApi(() => undefined)
    renderWithProviders(<AppRouter />, { route: '/login', path: '/*' })

    expect(await screen.findByText('bob')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Log in' })).not.toBeInTheDocument()
  })

  it('logs out', async () => {
    const fetchMock = stubApi(({ url }) => (url === '/api/auth/logout' ? new Response(null, { status: 200 }) : undefined))
    const { user } = renderWithProviders(<AppRouter />, { route: '/', path: '/*' })

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(requests(fetchMock)).toContainEqual({ method: 'POST', url: '/api/auth/logout', body: undefined })
  })
})
```

- [ ] **Step 3: Run them to verify they fail**

Run: `cd web && npm test`
Expected: FAIL — `./session`, `./LoginPage`, `./SignupPage`, `./router` cannot be resolved.

- [ ] **Step 4: Implement the session**

`web/src/features/auth/session.tsx`:
```tsx
import { useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { api, clearCsrf } from '../../api/client'
import { ApiError } from '../../api/errors'
import { setQueryErrorHandler } from '../../api/queryErrorBridge'
import type { Me } from '../../api/types'

interface SessionValue {
  me: Me | null
  /** True while the startup `/api/auth/me` check is in flight. */
  checking: boolean
  login(username: string, password: string): Promise<void>
  signup(username: string, password: string): Promise<void>
  logout(): Promise<void>
  setMe(me: Me): void
}

const SessionContext = createContext<SessionValue | null>(null)

export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Signed-in user state. Checks `/api/auth/me` on mount unless `initialMe` is given (tests).
 * Any query that fails with 401 signs the user out locally (the route guard then shows /login).
 */
export function SessionProvider({ children, initialMe }: { children: ReactNode; initialMe?: Me | null }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [me, setMeState] = useState<Me | null>(initialMe ?? null)
  const [checking, setChecking] = useState(initialMe === undefined)

  useEffect(() => {
    if (initialMe !== undefined) {
      return
    }
    let cancelled = false
    api
      .get<Me>('/api/auth/me')
      .then((result) => {
        if (!cancelled) setMeState(result)
      })
      .catch(() => {
        if (!cancelled) setMeState(null)
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [initialMe])

  useEffect(() => {
    setQueryErrorHandler((err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        setMeState(null)
        queryClient.clear()
      }
    })
    return () => setQueryErrorHandler(null)
  }, [queryClient])

  async function login(username: string, password: string): Promise<void> {
    const result = await api.post<Me>('/api/auth/login', { username, password })
    queryClient.clear()
    setMeState(result)
  }

  async function signup(username: string, password: string): Promise<void> {
    const result = await api.post<Me>('/api/auth/signup', { username, password, timezone: browserTimezone() })
    queryClient.clear()
    setMeState(result)
  }

  async function logout(): Promise<void> {
    try {
      await api.post('/api/auth/logout')
    } catch {
      // Sign out locally even if the request failed.
    } finally {
      clearCsrf()
      queryClient.clear()
      setMeState(null)
      navigate('/login')
    }
  }

  return (
    <SessionContext.Provider value={{ me, checking, login, signup, logout, setMe: setMeState }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return ctx
}
```

- [ ] **Step 5: Implement the login and sign-up pages**

`web/src/features/auth/LoginPage.tsx`:
```tsx
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { messageFor } from '../../api/errors'
import { useSession } from './session'

export const inputClass = 'rounded border border-muted/30 bg-bg px-3 py-2 text-muted'

export function LoginPage() {
  const { login } = useSession()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(messageFor(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <form onSubmit={(event) => void handleSubmit(event)} className="w-full max-w-sm rounded-lg bg-surface p-8">
        <h1 className="mb-6 text-center text-xl font-semibold text-accent">Log in</h1>
        <div className="mb-4 flex flex-col gap-1">
          <label htmlFor="username" className="text-sm">Username</label>
          <input id="username" autoComplete="username" value={username}
            onChange={(e) => setUsername(e.target.value)} className={inputClass} />
        </div>
        <div className="mb-4 flex flex-col gap-1">
          <label htmlFor="password" className="text-sm">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </div>
        {error && <p role="alert" className="mb-4 text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={submitting}
          className="w-full rounded bg-accent px-3 py-2 font-medium text-bg disabled:opacity-50">
          Log in
        </button>
        <p className="mt-4 text-center text-sm">
          New here? <Link to="/signup" className="text-accent">Create an account</Link>
        </p>
      </form>
    </div>
  )
}

export default LoginPage
```

`web/src/features/auth/SignupPage.tsx`:
```tsx
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { messageFor } from '../../api/errors'
import { inputClass } from './LoginPage'
import { browserTimezone, useSession } from './session'

export function SignupPage() {
  const { signup } = useSession()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signup(username, password)
      navigate('/')
    } catch (err) {
      setError(messageFor(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <form onSubmit={(event) => void handleSubmit(event)} className="w-full max-w-sm rounded-lg bg-surface p-8">
        <h1 className="mb-6 text-center text-xl font-semibold text-accent">Sign up</h1>
        <div className="mb-4 flex flex-col gap-1">
          <label htmlFor="username" className="text-sm">Username</label>
          <input id="username" autoComplete="username" value={username} minLength={3} maxLength={32}
            onChange={(e) => setUsername(e.target.value)} className={inputClass} />
          <span className="text-xs">3–32 letters, digits, “_”, “.” or “-”</span>
        </div>
        <div className="mb-4 flex flex-col gap-1">
          <label htmlFor="password" className="text-sm">Password</label>
          <input id="password" type="password" autoComplete="new-password" value={password} minLength={8}
            maxLength={128} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          <span className="text-xs">At least 8 characters</span>
        </div>
        <p className="mb-4 text-xs">Timezone: {browserTimezone()} (change it later in Settings)</p>
        {error && <p role="alert" className="mb-4 text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={submitting}
          className="w-full rounded bg-accent px-3 py-2 font-medium text-bg disabled:opacity-50">
          Sign up
        </button>
        <p className="mt-4 text-center text-sm">
          Have an account? <Link to="/login" className="text-accent">Log in</Link>
        </p>
      </form>
    </div>
  )
}

export default SignupPage
```

- [ ] **Step 6: Implement the shell, router and wiring**

`web/src/app/NotFound.tsx`:
```tsx
import { Link } from 'react-router'

export function NotFound() {
  return (
    <div className="p-8 text-center">
      <h1 className="mb-2 text-xl text-accent">Page not found</h1>
      <Link to="/" className="text-accent underline">Back to this week</Link>
    </div>
  )
}

export default NotFound
```

`web/src/app/Shell.tsx`:
```tsx
import { NavLink, Outlet } from 'react-router'
import { useSession } from '../features/auth/session'
import { WakingNotice } from './WakingNotice'

const tabs = [
  { to: '/', label: 'Week', end: true },
  { to: '/month', label: 'Month', end: false },
  { to: '/habits', label: 'Habits', end: false },
  { to: '/settings', label: 'Settings', end: false },
]

function tabClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'font-medium text-accent' : 'text-muted'
}

/** Top bar, desktop nav and a mobile bottom tab bar around the routed page. */
export function Shell() {
  const { me, logout } = useSession()

  const links = tabs.map(({ to, label, end }) => (
    <NavLink key={to} to={to} end={end} className={tabClass}>
      {label}
    </NavLink>
  ))

  return (
    <div className="flex min-h-screen flex-col bg-bg text-muted">
      <header className="flex items-center justify-between border-b border-muted/10 px-4 py-3">
        <span className="text-xl font-semibold tracking-wide text-accent">Chronos</span>
        <div className="flex items-center gap-3 text-sm">
          <span>{me?.username}</span>
          <button type="button" onClick={() => void logout()}>Log out</button>
        </div>
      </header>
      <nav aria-label="Primary" className="hidden gap-6 border-b border-muted/10 px-4 py-2 md:flex">
        {links}
      </nav>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-4 pb-24 md:pb-8">
        <Outlet />
      </main>
      <WakingNotice />
      <nav aria-label="Mobile"
        className="fixed inset-x-0 bottom-0 flex h-[calc(3.5rem+env(safe-area-inset-bottom))] justify-around border-t border-muted/10 bg-surface/95 pt-4 text-sm backdrop-blur md:hidden">
        {links}
      </nav>
    </div>
  )
}

export default Shell
```

`web/src/app/router.tsx`:
```tsx
import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { LoginPage } from '../features/auth/LoginPage'
import { useSession } from '../features/auth/session'
import { SignupPage } from '../features/auth/SignupPage'
import { NotFound } from './NotFound'
import { Shell } from './Shell'

/** Renders nothing during the startup session check, so a reload doesn't flash /login. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { me, checking } = useSession()
  if (checking) return null
  if (!me) return <Navigate to="/login" replace />
  return <>{children}</>
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { me, checking } = useSession()
  if (checking) return null
  if (me) return <Navigate to="/" replace />
  return <>{children}</>
}

/** Temporary home page; Task 4 replaces it with the week view. */
function Welcome() {
  const { me } = useSession()
  return <p>Welcome, {me?.username}.</p>
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/signup" element={<GuestOnly><SignupPage /></GuestOnly>} />
      <Route element={<RequireAuth><Shell /></RequireAuth>}>
        <Route path="/" element={<Welcome />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default AppRouter
```

`web/src/App.tsx` (replace):
```tsx
import { AppRouter } from './app/router'

function App() {
  return <AppRouter />
}

export default App
```

`web/src/main.tsx`: wrap `<App />` in the session provider (inside `BrowserRouter`, because it navigates):
```tsx
import { SessionProvider } from './features/auth/session'
// …
      <BrowserRouter>
        <SessionProvider>
          <App />
        </SessionProvider>
      </BrowserRouter>
```

- [ ] **Step 7: Run tests, lint and build**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: all PASS, no lint errors, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add web
git commit -m "feat(web): add session, login, sign-up and app shell" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Habits page (create, edit, pause/resume, archive/unarchive)

**Files:**
- Create: `web/src/features/habits/{api.ts,HabitForm.tsx,HabitsPage.tsx}`
- Modify: `web/src/app/router.tsx` (add the `/habits` route)
- Test: `web/src/features/habits/HabitsPage.test.tsx`

**Interfaces:**
- Consumes: `api`, `messageFor`, `Habit`, `HabitStatus`, `HabitTexts`, `NewHabit` (Task 1); `frequencyLabel` (Task 1); `renderWithProviders`, `stubApi`, `jsonResponse`, `problemResponse`, `requests` (Tasks 1–2).
- Produces:
  - `useHabits(status?: HabitStatus)` (query key `['habits', status ?? 'current']`)
  - `useCreateHabit()`, `useUpdateHabit()` (variables `HabitTexts & { id: number }`), `useHabitAction()` (variables `{ id: number; action: 'pause' | 'resume' | 'archive' | 'unarchive' }`) — all invalidate `['habits']` and `['stats']` on success.
  - `HabitsPage` at `/habits`.

- [ ] **Step 1: Write the failing test**

`web/src/features/habits/HabitsPage.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Habit } from '../../api/types'
import { jsonResponse, problemResponse, requests, stubApi, type ApiRequest } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { HabitsPage } from './HabitsPage'

const read: Habit = { id: 1, name: 'Read', minText: '1 page', targetText: '20 pages', frequency: 'DAILY',
  startDate: '2026-11-01', status: 'ACTIVE' }
const run: Habit = { id: 2, name: 'Run', minText: '1 km', targetText: '5 km', frequency: 'EVERY_N_DAYS',
  intervalDays: 3, startDate: '2026-11-02', status: 'PAUSED' }
const piano: Habit = { id: 3, name: 'Piano', minText: '5 min', targetText: '30 min', frequency: 'WEEKLY',
  startDate: '2026-10-01', status: 'ARCHIVED' }

function api(overrides: (r: ApiRequest) => Response | undefined = () => undefined) {
  return stubApi((r) => {
    const custom = overrides(r)
    if (custom) return custom
    if (r.method === 'GET' && r.url === '/api/habits') return jsonResponse([read, run])
    if (r.method === 'GET' && r.url === '/api/habits?status=ARCHIVED') return jsonResponse([piano])
    return undefined
  })
}

describe('HabitsPage', () => {
  it('lists current habits and keeps archived ones in a collapsed section', async () => {
    api()
    renderWithProviders(<HabitsPage />, { route: '/habits' })

    const readRow = await screen.findByRole('listitem', { name: 'Read' })
    expect(within(readRow).getByText('Daily')).toBeInTheDocument()
    expect(within(readRow).getByText('1 page', { exact: false })).toBeInTheDocument()
    const runRow = screen.getByRole('listitem', { name: 'Run' })
    expect(within(runRow).getByText('Every 3 days')).toBeInTheDocument()
    expect(within(runRow).getByText('Paused')).toBeInTheDocument()
    expect(within(runRow).getByRole('button', { name: 'Resume Run' })).toBeInTheDocument()
    expect(await screen.findByText('Archived (1)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unarchive Piano' })).toBeInTheDocument()
  })

  it('creates an every-N-days habit', async () => {
    const fetchMock = api((r) => (r.method === 'POST' ? jsonResponse({ ...run, id: 9, status: 'ACTIVE' }, 201) : undefined))
    const { user } = renderWithProviders(<HabitsPage />, { route: '/habits' })

    await user.click(await screen.findByRole('button', { name: 'New habit' }))
    await user.type(screen.getByLabelText('Name'), 'Run')
    await user.type(screen.getByLabelText('Bare minimum (YELLOW)'), '1 km')
    await user.type(screen.getByLabelText('Target (GREEN)'), '5 km')
    await user.selectOptions(screen.getByLabelText('Frequency'), 'EVERY_N_DAYS')
    await user.clear(screen.getByLabelText('Every how many days?'))
    await user.type(screen.getByLabelText('Every how many days?'), '3')
    await user.click(screen.getByRole('button', { name: 'Create habit' }))

    expect(await screen.findByRole('button', { name: 'New habit' })).toBeInTheDocument()
    expect(requests(fetchMock).find((r) => r.method === 'POST')).toEqual({
      method: 'POST',
      url: '/api/habits',
      body: { name: 'Run', minText: '1 km', targetText: '5 km', frequency: 'EVERY_N_DAYS', intervalDays: 3 },
    })
  })

  it('only asks for an interval for every-N-days habits', async () => {
    api()
    const { user } = renderWithProviders(<HabitsPage />, { route: '/habits' })

    await user.click(await screen.findByRole('button', { name: 'New habit' }))

    expect(screen.queryByLabelText('Every how many days?')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Frequency'), 'EVERY_N_DAYS')
    expect(screen.getByLabelText('Every how many days?')).toBeInTheDocument()
  })

  it('edits only the texts', async () => {
    const fetchMock = api((r) => (r.method === 'PUT' ? jsonResponse({ ...read, name: 'Read more' }) : undefined))
    const { user } = renderWithProviders(<HabitsPage />, { route: '/habits' })

    await user.click(await screen.findByRole('button', { name: 'Edit Read' }))
    expect(screen.queryByLabelText('Frequency')).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Read more')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('button', { name: 'Edit Read' })).toBeInTheDocument()
    expect(requests(fetchMock).find((r) => r.method === 'PUT')).toEqual({
      method: 'PUT',
      url: '/api/habits/1',
      body: { name: 'Read more', minText: '1 page', targetText: '20 pages' },
    })
  })

  it('pauses and archives', async () => {
    const fetchMock = api((r) => (r.method === 'POST' ? jsonResponse(read) : undefined))
    const { user } = renderWithProviders(<HabitsPage />, { route: '/habits' })

    await user.click(await screen.findByRole('button', { name: 'Pause Read' }))
    await user.click(screen.getByRole('button', { name: 'Archive Read' }))

    const posts = requests(fetchMock).filter((r) => r.method === 'POST').map((r) => r.url)
    expect(posts).toEqual(['/api/habits/1/pause', '/api/habits/1/archive'])
  })

  it('shows action errors', async () => {
    api((r) => (r.method === 'POST' ? problemResponse(409, 'INVALID_STATE') : undefined))
    const { user } = renderWithProviders(<HabitsPage />, { route: '/habits' })

    await user.click(await screen.findByRole('button', { name: 'Pause Read' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("That action isn't available")
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npx vitest run src/features/habits`
Expected: FAIL — `./HabitsPage` cannot be resolved.

- [ ] **Step 3: Implement the API hooks**

`web/src/features/habits/api.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Habit, HabitStatus, HabitTexts, NewHabit } from '../../api/types'

export type HabitAction = 'pause' | 'resume' | 'archive' | 'unarchive'

export function useHabits(status?: HabitStatus) {
  return useQuery({
    queryKey: ['habits', status ?? 'current'],
    queryFn: () => api.get<Habit[]>('/api/habits', { status }),
  })
}

/** Habit changes affect every stats view, so both caches are refreshed. */
function useInvalidateHabits() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['habits'] }),
      queryClient.invalidateQueries({ queryKey: ['stats'] }),
    ])
}

export function useCreateHabit() {
  const invalidate = useInvalidateHabits()
  return useMutation({ mutationFn: (body: NewHabit) => api.post<Habit>('/api/habits', body), onSuccess: invalidate })
}

export function useUpdateHabit() {
  const invalidate = useInvalidateHabits()
  return useMutation({
    mutationFn: ({ id, ...texts }: HabitTexts & { id: number }) => api.put<Habit>(`/api/habits/${id}`, texts),
    onSuccess: invalidate,
  })
}

export function useHabitAction() {
  const invalidate = useInvalidateHabits()
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: HabitAction }) => api.post<Habit>(`/api/habits/${id}/${action}`),
    onSuccess: invalidate,
  })
}
```

- [ ] **Step 4: Implement the form**

`web/src/features/habits/HabitForm.tsx`:
```tsx
import { useState, type FormEvent } from 'react'
import { messageFor } from '../../api/errors'
import type { Frequency, Habit, NewHabit } from '../../api/types'
import { inputClass } from '../auth/LoginPage'

interface HabitFormProps {
  /** When set, the form edits this habit's texts; schedule fields are hidden (they're immutable). */
  habit?: Habit
  submitLabel: string
  onSubmit(values: NewHabit): Promise<unknown>
  onCancel(): void
}

export function HabitForm({ habit, submitLabel, onSubmit, onCancel }: HabitFormProps) {
  const [name, setName] = useState(habit?.name ?? '')
  const [minText, setMinText] = useState(habit?.minText ?? '')
  const [targetText, setTargetText] = useState(habit?.targetText ?? '')
  const [frequency, setFrequency] = useState<Frequency>('DAILY')
  const [intervalDays, setIntervalDays] = useState('2')
  const [startDate, setStartDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        name,
        minText,
        targetText,
        frequency,
        intervalDays: frequency === 'EVERY_N_DAYS' ? Number(intervalDays) : undefined,
        startDate: startDate || undefined,
      })
    } catch (err) {
      setError(messageFor(err))
    } finally {
      setSubmitting(false)
    }
  }

  const field = 'mb-3 flex flex-col gap-1'
  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="mb-4 rounded-lg bg-surface p-4">
      <div className={field}>
        <label htmlFor="habit-name" className="text-sm">Name</label>
        <input id="habit-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)}
          className={inputClass} />
      </div>
      <div className={field}>
        <label htmlFor="habit-min" className="text-sm">Bare minimum (YELLOW)</label>
        <input id="habit-min" required maxLength={200} value={minText} onChange={(e) => setMinText(e.target.value)}
          className={inputClass} />
      </div>
      <div className={field}>
        <label htmlFor="habit-target" className="text-sm">Target (GREEN)</label>
        <input id="habit-target" required maxLength={200} value={targetText}
          onChange={(e) => setTargetText(e.target.value)} className={inputClass} />
      </div>
      {!habit && (
        <>
          <div className={field}>
            <label htmlFor="habit-frequency" className="text-sm">Frequency</label>
            <select id="habit-frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}
              className={inputClass}>
              <option value="DAILY">Daily</option>
              <option value="EVERY_N_DAYS">Every N days</option>
              <option value="WEEKLY">Weekly (once per Mon–Sun week)</option>
            </select>
          </div>
          {frequency === 'EVERY_N_DAYS' && (
            <div className={field}>
              <label htmlFor="habit-interval" className="text-sm">Every how many days?</label>
              <input id="habit-interval" type="number" min={2} max={365} required value={intervalDays}
                onChange={(e) => setIntervalDays(e.target.value)} className={inputClass} />
            </div>
          )}
          <div className={field}>
            <label htmlFor="habit-start" className="text-sm">Start date (optional, defaults to today)</label>
            <input id="habit-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className={inputClass} />
          </div>
        </>
      )}
      {error && <p role="alert" className="mb-3 text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={submitting}
          className="rounded bg-accent px-3 py-2 font-medium text-bg disabled:opacity-50">
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="rounded px-3 py-2">Cancel</button>
      </div>
    </form>
  )
}

export default HabitForm
```

- [ ] **Step 5: Implement the page and route**

`web/src/features/habits/HabitsPage.tsx`:
```tsx
import { useState } from 'react'
import { messageFor } from '../../api/errors'
import type { Habit } from '../../api/types'
import { frequencyLabel } from '../../lib/cells'
import { useCreateHabit, useHabitAction, useHabits, useUpdateHabit, type HabitAction } from './api'
import { HabitForm } from './HabitForm'

const smallButton = 'rounded border border-muted/30 px-2 py-1 text-xs'

export function HabitsPage() {
  const current = useHabits()
  const archived = useHabits('ARCHIVED')
  const createHabit = useCreateHabit()
  const updateHabit = useUpdateHabit()
  const habitAction = useHabitAction()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function act(id: number, action: HabitAction): Promise<void> {
    setError(null)
    try {
      await habitAction.mutateAsync({ id, action })
    } catch (err) {
      setError(messageFor(err))
    }
  }

  function row(habit: Habit) {
    if (editingId === habit.id) {
      return (
        <li key={habit.id} aria-label={habit.name}>
          <HabitForm habit={habit} submitLabel="Save" onCancel={() => setEditingId(null)}
            onSubmit={async ({ name, minText, targetText }) => {
              await updateHabit.mutateAsync({ id: habit.id, name, minText, targetText })
              setEditingId(null)
            }} />
        </li>
      )
    }
    const isArchived = habit.status === 'ARCHIVED'
    return (
      <li key={habit.id} aria-label={habit.name} className="rounded-lg bg-surface p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-accent">{habit.name}</span>
          <span className="text-xs">{frequencyLabel(habit.frequency, habit.intervalDays)}</span>
        </div>
        {habit.status === 'PAUSED' && <span className="text-xs uppercase">Paused</span>}
        <p className="text-sm">Minimum: {habit.minText}</p>
        <p className="text-sm">Target: {habit.targetText}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {isArchived ? (
            <button type="button" aria-label={`Unarchive ${habit.name}`} className={smallButton}
              onClick={() => void act(habit.id, 'unarchive')}>Unarchive</button>
          ) : (
            <>
              <button type="button" aria-label={`Edit ${habit.name}`} className={smallButton}
                onClick={() => setEditingId(habit.id)}>Edit</button>
              {habit.status === 'PAUSED' ? (
                <button type="button" aria-label={`Resume ${habit.name}`} className={smallButton}
                  onClick={() => void act(habit.id, 'resume')}>Resume</button>
              ) : (
                <button type="button" aria-label={`Pause ${habit.name}`} className={smallButton}
                  onClick={() => void act(habit.id, 'pause')}>Pause</button>
              )}
              <button type="button" aria-label={`Archive ${habit.name}`} className={smallButton}
                onClick={() => void act(habit.id, 'archive')}>Archive</button>
            </>
          )}
        </div>
      </li>
    )
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-accent">Habits</h1>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)}
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-bg">New habit</button>
        )}
      </div>
      {creating && (
        <HabitForm submitLabel="Create habit" onCancel={() => setCreating(false)}
          onSubmit={async (values) => {
            await createHabit.mutateAsync(values)
            setCreating(false)
          }} />
      )}
      {error && <p role="alert" className="mb-3 text-sm text-red-400">{error}</p>}
      {current.isPending && <p>Loading…</p>}
      {current.data?.length === 0 && !creating && <p>No habits yet. Create your first one.</p>}
      <ul className="flex flex-col gap-3">{current.data?.map(row)}</ul>
      {archived.data && archived.data.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm">Archived ({archived.data.length})</summary>
          <ul className="mt-3 flex flex-col gap-3 opacity-80">{archived.data.map(row)}</ul>
        </details>
      )}
    </section>
  )
}

export default HabitsPage
```

`web/src/app/router.tsx`: import `HabitsPage` and add the route inside the `Shell` route, before `*`:
```tsx
import { HabitsPage } from '../features/habits/HabitsPage'
// …
        <Route path="/habits" element={<HabitsPage />} />
```

- [ ] **Step 6: Run tests, lint and build**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: all PASS.

> jsdom renders `<details>` content even when collapsed, which is why the test can find `Unarchive Piano` without opening it.

- [ ] **Step 7: Commit**

```bash
git add web
git commit -m "feat(web): add habits page with create, edit and lifecycle actions" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---
