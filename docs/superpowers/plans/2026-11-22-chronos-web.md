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

### Task 4: Week view (grid, cell picker, distribution, streaks)

Matches mockup 1 and 2 in `docs/superpowers/specs/2026-11-22-chronos-ui-mockups.html`.

**Files:**
- Create: `web/src/features/stats/{api.ts,DistributionBar.tsx,StreakList.tsx}`, `web/src/features/week/{WeekGrid,CellPicker,WeekPage}.tsx`
- Modify: `web/src/app/router.tsx` (`/` → `WeekPage`; delete `Welcome`)
- Test: `web/src/features/stats/DistributionBar.test.tsx`, `web/src/features/week/WeekPage.test.tsx`

**Interfaces:**
- Consumes: `api`, `messageFor`, `Color`, `Distribution`, `Streak`, `WeekView`, `WeekHabit`, `WeekCell`, `MonthView` (Task 1); `addDays`, `dayOfMonth`, `formatDay`, `formatWeekRange`, `WEEKDAYS` (Task 1); `cellClass`, `STATE_LABEL` (Task 1); `renderWithProviders`, test http helpers (Tasks 1–2).
- Produces:
  - `useWeek(start?: string)` (key `['stats', 'week', start ?? 'current']`), `useMonth(month?: string)` (key `['stats', 'month', month ?? 'current']`), `useStreaks()` (key `['stats', 'streaks']`)
  - `useSaveCheckIn()` (variables `{ habitId: number; periodStart: string; color: Color; note: string | null }`), `useClearCheckIn()` (variables `{ habitId: number; periodStart: string }`) — both invalidate `['stats']`.
  - `DistributionBar({ title, distribution })` — reused by Task 5.
  - `WeekPage` at `/`, reading `?start=YYYY-MM-DD`.
  - Cell buttons are labelled `"<habit>, <Wed 18 Nov>, <state label>"` (weekly habits: `"<habit>, week of <Mon 16 Nov>, <state label>"`); the e2e test in Task 7 relies on this.

- [ ] **Step 1: Write the failing tests**

`web/src/features/stats/DistributionBar.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DistributionBar } from './DistributionBar'

describe('DistributionBar', () => {
  it('shows counts with rounded percentages', () => {
    render(<DistributionBar title="This week" distribution={{ green: 1, yellow: 1, red: 1, grey: 0, total: 3 }} />)

    expect(screen.getByRole('heading', { name: 'This week' })).toBeInTheDocument()
    expect(screen.getByText('Green 1 (33%)')).toBeInTheDocument()
    expect(screen.getByText('Yellow 1 (33%)')).toBeInTheDocument()
    expect(screen.getByText('Red 1 (33%)')).toBeInTheDocument()
    expect(screen.getByText('Grey 0 (0%)')).toBeInTheDocument()
  })

  it('says when nothing is marked', () => {
    render(<DistributionBar title="This week" distribution={{ green: 0, yellow: 0, red: 0, grey: 0, total: 0 }} />)

    expect(screen.getByText('Nothing marked yet')).toBeInTheDocument()
  })
})
```

`web/src/features/week/WeekPage.test.tsx`:
```tsx
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Streak, WeekCell, WeekView } from '../../api/types'
import { jsonResponse, problemResponse, requests, stubApi, type ApiRequest } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { WeekPage } from './WeekPage'

const days = ['16', '17', '18', '19', '20', '21', '22'].map((d) => `2026-11-${d}`)

function daily(states: WeekCell['state'][]): WeekCell[] {
  return days.map((date, i) => ({
    date,
    periodStart: date,
    state: states[i],
    editable: date <= '2026-11-18',
    note: i === 0 ? 'great' : null,
  }))
}

const week: WeekView = {
  start: '2026-11-16',
  today: '2026-11-18',
  distribution: { green: 1, yellow: 0, red: 1, grey: 0, total: 2 },
  habits: [
    { id: 1, name: 'Read', minText: '1 page', targetText: '20 pages', frequency: 'DAILY',
      cells: daily(['GREEN', 'RED', 'PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING']) },
    { id: 2, name: 'Piano', minText: '5 min', targetText: '30 min', frequency: 'WEEKLY',
      cells: [{ date: '2026-11-16', periodStart: '2026-11-16', state: 'PENDING', editable: true, note: null }] },
  ],
}
const streaks: Streak[] = [{ habitId: 1, name: 'Read', current: 0, best: 9 }]

function api(overrides: (r: ApiRequest) => Response | undefined = () => undefined) {
  return stubApi((r) => {
    const custom = overrides(r)
    if (custom) return custom
    if (r.url.startsWith('/api/stats/week')) return jsonResponse(week)
    if (r.url === '/api/stats/streaks') return jsonResponse(streaks)
    return undefined
  })
}

describe('WeekPage', () => {
  it('shows the grid, distribution and streaks', async () => {
    api()
    renderWithProviders(<WeekPage />)

    expect(await screen.findByRole('heading', { name: '16 – 22 Nov 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Read, Mon 16 Nov, Target hit' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Read, Tue 17 Nov, Did nothing' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Read, Thu 19 Nov, Not marked yet' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Piano, week of Mon 16 Nov, Not marked yet' })).toBeEnabled()
    expect(screen.getByText('Green 1 (50%)')).toBeInTheDocument()
    expect(await screen.findByRole('listitem', { name: 'Read' })).toHaveTextContent('0 now · best 9')
  })

  it("marks today's cells", async () => {
    api()
    renderWithProviders(<WeekPage />)

    expect(await screen.findByRole('button', { name: 'Read, Wed 18 Nov, Not marked yet' })).toHaveAttribute('aria-current', 'date')
    expect(screen.getByRole('button', { name: /^Piano/ })).toHaveAttribute('aria-current', 'date')
    expect(screen.getByRole('button', { name: /^Read, Tue/ })).not.toHaveAttribute('aria-current')
  })

  it('saves a color with a note', async () => {
    const fetchMock = api((r) => (r.method === 'PUT' ? jsonResponse({ periodStart: '2026-11-18', color: 'GREEN', note: 'ch 4' }) : undefined))
    const { user } = renderWithProviders(<WeekPage />)

    await user.click(await screen.findByRole('button', { name: 'Read, Wed 18 Nov, Not marked yet' }))
    const dialog = screen.getByRole('dialog', { name: 'Read, Wed 18 Nov' })
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: /^Green/ })).toHaveTextContent('Target: 20 pages')
    expect(within(dialog).getByRole('button', { name: /^Yellow/ })).toHaveTextContent('Minimum: 1 page')
    await user.click(within(dialog).getByRole('button', { name: /^Green/ }))
    await user.type(within(dialog).getByLabelText('Note (optional)'), 'ch 4')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(requests(fetchMock).find((r) => r.method === 'PUT')).toEqual({
      method: 'PUT',
      url: '/api/habits/1/check-ins/2026-11-18',
      body: { color: 'GREEN', note: 'ch 4' },
    })
    await waitFor(() =>
      expect(requests(fetchMock).filter((r) => r.url.startsWith('/api/stats/week')).length).toBeGreaterThan(1),
    )
  })

  it('opens with the current color and note, and clears', async () => {
    const fetchMock = api((r) => (r.method === 'DELETE' ? new Response(null, { status: 204 }) : undefined))
    const { user } = renderWithProviders(<WeekPage />)

    await user.click(await screen.findByRole('button', { name: 'Read, Mon 16 Nov, Target hit' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: /^Green/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByLabelText('Note (optional)')).toHaveValue('great')
    await user.click(within(dialog).getByRole('button', { name: 'Clear' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(requests(fetchMock).find((r) => r.method === 'DELETE')?.url).toBe('/api/habits/1/check-ins/2026-11-16')
  })

  it('has no Clear for unmarked periods and closes on Cancel', async () => {
    api()
    const { user } = renderWithProviders(<WeekPage />)

    await user.click(await screen.findByRole('button', { name: /^Piano/ }))
    expect(screen.getByRole('dialog', { name: 'Piano, week of Mon 16 Nov' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows save errors in the picker', async () => {
    api((r) => (r.method === 'PUT' ? problemResponse(422, 'CHECK_IN_NOT_ALLOWED') : undefined))
    const { user } = renderWithProviders(<WeekPage />)

    await user.click(await screen.findByRole('button', { name: 'Read, Tue 17 Nov, Did nothing' }))
    await user.click(screen.getByRole('button', { name: /^Yellow/ }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent(
      'That period can no longer be changed',
    )
  })

  it('moves between weeks', async () => {
    const fetchMock = api()
    const { user } = renderWithProviders(<WeekPage />)

    expect(screen.queryByRole('button', { name: 'This week' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Previous week' }))

    expect(await screen.findByRole('button', { name: 'This week' })).toBeInTheDocument()
    expect(requests(fetchMock).map((r) => r.url)).toContain('/api/stats/week?start=2026-11-09')
  })

  it('points to the habits page when there are none', async () => {
    api((r) => (r.url.startsWith('/api/stats/week') ? jsonResponse({ ...week, habits: [], distribution: { green: 0, yellow: 0, red: 0, grey: 0, total: 0 } }) : undefined))
    renderWithProviders(<WeekPage />)

    expect(await screen.findByRole('link', { name: 'Create your first habit' })).toHaveAttribute('href', '/habits')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd web && npx vitest run src/features/stats src/features/week`
Expected: FAIL — `./DistributionBar` and `./WeekPage` cannot be resolved.

- [ ] **Step 3: Implement the stats API hooks**

`web/src/features/stats/api.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Color, MonthView, Streak, WeekView } from '../../api/types'

export function useWeek(start?: string) {
  return useQuery({
    queryKey: ['stats', 'week', start ?? 'current'],
    queryFn: () => api.get<WeekView>('/api/stats/week', { start }),
  })
}

export function useMonth(month?: string) {
  return useQuery({
    queryKey: ['stats', 'month', month ?? 'current'],
    queryFn: () => api.get<MonthView>('/api/stats/month', { month }),
  })
}

export function useStreaks() {
  return useQuery({ queryKey: ['stats', 'streaks'], queryFn: () => api.get<Streak[]>('/api/stats/streaks') })
}

interface CheckInKey {
  habitId: number
  periodStart: string
}

function checkInPath({ habitId, periodStart }: CheckInKey): string {
  return `/api/habits/${habitId}/check-ins/${periodStart}`
}

export function useSaveCheckIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ color, note, ...key }: CheckInKey & { color: Color; note: string | null }) =>
      api.put(checkInPath(key), { color, note }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stats'] }),
  })
}

export function useClearCheckIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (key: CheckInKey) => api.del(checkInPath(key)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stats'] }),
  })
}
```

- [ ] **Step 4: Implement the distribution bar and streak list**

`web/src/features/stats/DistributionBar.tsx`:
```tsx
import type { Distribution } from '../../api/types'

const SEGMENTS = [
  { key: 'green', label: 'Green', className: 'bg-cell-green' },
  { key: 'yellow', label: 'Yellow', className: 'bg-cell-yellow' },
  { key: 'red', label: 'Red', className: 'bg-cell-red' },
  { key: 'grey', label: 'Grey', className: 'bg-cell-grey' },
] as const

export function DistributionBar({ title, distribution }: { title: string; distribution: Distribution }) {
  const { total } = distribution
  return (
    <section className="rounded-lg bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-200">{title}</h2>
      {total === 0 ? (
        <p className="text-sm">Nothing marked yet</p>
      ) : (
        <>
          <div className="flex h-3 overflow-hidden rounded-md" aria-hidden="true">
            {SEGMENTS.map(({ key, className }) => (
              <div key={key} className={className} style={{ width: `${(distribution[key] * 100) / total}%` }} />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {SEGMENTS.map(({ key, label, className }) => (
              <li key={key} className="flex items-center gap-1">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${className}`} aria-hidden="true" />
                {`${label} ${distribution[key]} (${Math.round((distribution[key] * 100) / total)}%)`}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export default DistributionBar
```

`web/src/features/stats/StreakList.tsx`:
```tsx
import { useStreaks } from './api'

/** Current and best streak per habit; streaks count GREEN/YELLOW periods and skip paused ones. */
export function StreakList() {
  const { data } = useStreaks()
  return (
    <section className="rounded-lg bg-surface p-4">
      <h2 className="mb-2 text-sm font-semibold text-slate-200">Streaks</h2>
      {data?.length === 0 && <p className="text-sm">No habits yet</p>}
      <ul>
        {data?.map((streak) => (
          <li key={streak.habitId} aria-label={streak.name}
            className="flex justify-between border-b border-muted/10 py-1.5 text-sm last:border-0">
            <span>{streak.name}</span>
            <span>{`${streak.current} now · best ${streak.best}`}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default StreakList
```

- [ ] **Step 5: Implement the grid and picker**

`web/src/features/week/WeekGrid.tsx`:
```tsx
import type { WeekCell, WeekHabit } from '../../api/types'
import { addDays, dayOfMonth, formatDay, WEEKDAYS } from '../../lib/dates'
import { cellClass, STATE_LABEL } from '../../lib/cells'

/** "Wed 18 Nov", or "week of Mon 16 Nov" for weekly habits. */
export function periodLabel(habit: WeekHabit, cell: WeekCell): string {
  return habit.frequency === 'WEEKLY' ? `week of ${formatDay(cell.date)}` : formatDay(cell.date)
}

function coversToday(habit: WeekHabit, cell: WeekCell, today: string): boolean {
  return habit.frequency === 'WEEKLY' ? cell.date <= today && today <= addDays(cell.date, 6) : cell.date === today
}

interface WeekGridProps {
  start: string
  today: string
  habits: WeekHabit[]
  onPick(habit: WeekHabit, cell: WeekCell): void
}

export function WeekGrid({ start, today, habits, onPick }: WeekGridProps) {
  return (
    <table className="w-full table-fixed border-separate border-spacing-1 md:border-spacing-1.5">
      <thead>
        <tr>
          <th className="w-16 md:w-28" />
          {WEEKDAYS.map((weekday, i) => (
            <th key={weekday} scope="col" className="text-center text-[11px] font-medium">
              {weekday}
              <span className="block text-[10px] opacity-70">{dayOfMonth(addDays(start, i))}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {habits.map((habit) => (
          <tr key={habit.id}>
            <th scope="row" className="truncate text-left text-xs font-medium text-slate-300 md:text-sm">
              {habit.name}
              {habit.frequency === 'WEEKLY' && <span className="block text-[10px] font-normal opacity-70">weekly</span>}
            </th>
            {habit.cells.map((cell) => {
              const isToday = coversToday(habit, cell, today)
              return (
                <td key={cell.date} colSpan={habit.frequency === 'WEEKLY' ? 7 : undefined}>
                  <button
                    type="button"
                    aria-label={`${habit.name}, ${periodLabel(habit, cell)}, ${STATE_LABEL[cell.state]}`}
                    aria-current={isToday ? 'date' : undefined}
                    disabled={!cell.editable}
                    onClick={() => onPick(habit, cell)}
                    className={`block h-8 w-full rounded-md md:h-9 ${cellClass(cell.state)} ${
                      isToday ? 'outline-2 outline-offset-2 outline-accent' : ''
                    } ${cell.editable ? 'cursor-pointer' : cell.state === 'NOT_DUE' ? '' : 'opacity-55'}`}
                  />
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default WeekGrid
```

`web/src/features/week/CellPicker.tsx`:
```tsx
import { useState } from 'react'
import { messageFor } from '../../api/errors'
import type { Color, WeekCell, WeekHabit } from '../../api/types'
import { cellClass, STATE_LABEL } from '../../lib/cells'
import { useClearCheckIn, useSaveCheckIn } from '../stats/api'
import { periodLabel } from './WeekGrid'

const CHOICES: { color: Color; label: string; hint(habit: WeekHabit): string }[] = [
  { color: 'GREEN', label: 'Green', hint: (habit) => `Target: ${habit.targetText}` },
  { color: 'YELLOW', label: 'Yellow', hint: (habit) => `Minimum: ${habit.minText}` },
  { color: 'RED', label: 'Red', hint: () => 'Did nothing' },
]

function isColor(state: WeekCell['state']): state is Color {
  return state === 'GREEN' || state === 'YELLOW' || state === 'RED'
}

interface CellPickerProps {
  habit: WeekHabit
  cell: WeekCell
  onClose(): void
}

/** Bottom sheet on phones, centred dialog on wider screens. Saves only on "Save". */
export function CellPicker({ habit, cell, onClose }: CellPickerProps) {
  const saveCheckIn = useSaveCheckIn()
  const clearCheckIn = useClearCheckIn()
  const marked = isColor(cell.state)
  const [color, setColor] = useState<Color | null>(marked ? (cell.state as Color) : null)
  const [note, setNote] = useState(cell.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const busy = saveCheckIn.isPending || clearCheckIn.isPending
  const key = { habitId: habit.id, periodStart: cell.periodStart ?? cell.date }
  const title = `${habit.name}, ${periodLabel(habit, cell)}`

  async function run(action: () => Promise<unknown>): Promise<void> {
    setError(null)
    try {
      await action()
      onClose()
    } catch (err) {
      setError(messageFor(err))
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 md:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}>
      <div role="dialog" aria-modal="true" aria-label={title}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
        }}
        className="w-full rounded-t-2xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:max-w-sm md:rounded-2xl">
        <h2 className="text-base font-semibold text-white">{habit.name}</h2>
        <p className="mb-4 text-xs">{`${periodLabel(habit, cell)} · ${STATE_LABEL[cell.state]}`}</p>
        {CHOICES.map((choice) => (
          <button key={choice.color} type="button" aria-pressed={color === choice.color}
            onClick={() => setColor(choice.color)}
            className={`mb-2 flex w-full items-center gap-3 rounded-lg border bg-bg p-3 text-left text-sm text-slate-100 ${
              color === choice.color ? 'border-accent ring-1 ring-accent' : 'border-muted/20'
            }`}>
            <span className={`h-5 w-5 flex-none rounded-md ${cellClass(choice.color)}`} aria-hidden="true" />
            <span>
              {choice.label}
              <small className="block text-xs text-muted">{choice.hint(habit)}</small>
            </span>
          </button>
        ))}
        <label htmlFor="check-in-note" className="mt-3 mb-1 block text-xs">Note (optional)</label>
        <textarea id="check-in-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
          className="w-full rounded border border-muted/30 bg-bg px-3 py-2 text-sm" />
        {error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}
        <div className="mt-4 flex items-center justify-between">
          {marked ? (
            <button type="button" disabled={busy} className="rounded border border-muted/30 px-3 py-1.5 text-sm"
              onClick={() => void run(() => clearCheckIn.mutateAsync(key))}>Clear</button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded border border-muted/30 px-3 py-1.5 text-sm">
              Cancel
            </button>
            <button type="button" disabled={!color || busy}
              className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-bg disabled:opacity-50"
              onClick={() => {
                if (color) void run(() => saveCheckIn.mutateAsync({ ...key, color, note: note.trim() || null }))
              }}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CellPicker
```

- [ ] **Step 6: Implement the page and route**

`web/src/features/week/WeekPage.tsx`:
```tsx
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { WeekCell, WeekHabit } from '../../api/types'
import { addDays, formatWeekRange } from '../../lib/dates'
import { useWeek } from '../stats/api'
import { DistributionBar } from '../stats/DistributionBar'
import { StreakList } from '../stats/StreakList'
import { CellPicker } from './CellPicker'
import { WeekGrid } from './WeekGrid'

const navButton = 'rounded border border-muted/30 px-2.5 py-1 text-xs'

export function WeekPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const start = searchParams.get('start') ?? undefined
  const { data, isPending, isError } = useWeek(start)
  const [picked, setPicked] = useState<{ habit: WeekHabit; cell: WeekCell } | null>(null)

  if (isPending) return <p>Loading…</p>
  if (isError) return <p role="alert">Couldn't load this week.</p>

  const goTo = (weekStart: string) => setSearchParams({ start: weekStart })

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <button type="button" aria-label="Previous week" className={navButton}
          onClick={() => goTo(addDays(data.start, -7))}>◀</button>
        <h1 className="text-lg font-semibold text-accent md:text-xl">{formatWeekRange(data.start)}</h1>
        <button type="button" aria-label="Next week" className={navButton}
          onClick={() => goTo(addDays(data.start, 7))}>▶</button>
        {start && (
          <button type="button" className={navButton} onClick={() => setSearchParams({})}>This week</button>
        )}
      </div>
      {data.habits.length === 0 ? (
        <p className="mb-4">
          No habits yet. <Link to="/habits" className="text-accent underline">Create your first habit</Link>
        </p>
      ) : (
        <WeekGrid start={data.start} today={data.today} habits={data.habits}
          onPick={(habit, cell) => setPicked({ habit, cell })} />
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <DistributionBar title="This week" distribution={data.distribution} />
        <StreakList />
      </div>
      {picked && <CellPicker habit={picked.habit} cell={picked.cell} onClose={() => setPicked(null)} />}
    </section>
  )
}

export default WeekPage
```

`web/src/app/router.tsx`: delete the `Welcome` component, import `WeekPage`, and change the index route:
```tsx
import { WeekPage } from '../features/week/WeekPage'
// …
        <Route path="/" element={<WeekPage />} />
```

`web/src/app/router.test.tsx`: the "shows the shell to signed-in users" and "keeps signed-in users away from the login page" tests now render the week page, whose requests 404 in those stubs. That's fine (the page shows "Couldn't load this week." and the assertions only check the shell), so leave them unchanged.

- [ ] **Step 7: Run tests, lint and build**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add web
git commit -m "feat(web): add week grid with check-in picker, distribution and streaks" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Month view (score heatmap, distribution, per-habit calendars)

Matches mockup 3 in `docs/superpowers/specs/2026-11-22-chronos-ui-mockups.html`.

**Files:**
- Create: `web/src/features/month/{CalendarGrid,MonthPage}.tsx`
- Modify: `web/src/app/router.tsx` (add `/month`)
- Test: `web/src/features/month/MonthPage.test.tsx`

**Interfaces:**
- Consumes: `useMonth` (Task 4), `DistributionBar` (Task 4), `MonthView` (Task 1), `addMonths`, `formatDay`, `formatMonth`, `dayOfMonth`, `weekdayIndex`, `WEEKDAYS` (Task 1), `cellClass`, `STATE_LABEL` (Task 1).
- Produces:
  - `scoreClass(score: number | null): string` and `CalendarGrid({ days, showNumbers?, compact? })`, where `days: { date: string; className: string; label: string }[]` (one month, in order).
  - `MonthPage` at `/month`, reading `?month=YYYY-MM`.

- [ ] **Step 1: Write the failing test**

`web/src/features/month/MonthPage.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CellState, MonthView } from '../../api/types'
import { jsonResponse, requests, stubApi } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { MonthPage } from './MonthPage'

const dates = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`)
const scores: (number | null)[] = [2, 0.3, 1, 1.25, 0.5]

const month: MonthView = {
  month: '2026-11',
  distribution: { green: 2, yellow: 1, red: 1, grey: 0, total: 4 },
  overview: dates.map((date, i) => ({ date, score: scores[i] ?? null })),
  habits: [
    { id: 1, name: 'Read', frequency: 'DAILY',
      cells: dates.map((date, i) => ({ date, state: ((['GREEN', 'RED'] as CellState[])[i] ?? 'PENDING') })) },
  ],
}

describe('MonthPage', () => {
  it('colors the overview by score, Monday first', async () => {
    stubApi(({ url }) => (url.startsWith('/api/stats/month') ? jsonResponse(month) : undefined))
    renderWithProviders(<MonthPage />, { route: '/month' })

    expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument()
    const overview = screen.getByRole('region', { name: 'Daily score' })
    expect(within(overview).getByRole('img', { name: 'Sun 1 Nov: score 2.0' })).toHaveClass('bg-cell-green')
    expect(within(overview).getByRole('img', { name: 'Mon 2 Nov: score 0.3' })).toHaveClass('bg-cell-red')
    expect(within(overview).getByRole('img', { name: 'Tue 3 Nov: score 1.0' })).toHaveClass('bg-cell-yellow')
    expect(within(overview).getByRole('img', { name: 'Wed 4 Nov: score 1.3' })).toHaveClass('bg-cell-green')
    expect(within(overview).getByRole('img', { name: 'Thu 5 Nov: score 0.5' })).toHaveClass('bg-cell-yellow')
    expect(within(overview).getByRole('img', { name: 'Fri 6 Nov: no score' })).toHaveClass('border')
    // 1 Nov 2026 is a Sunday: six blanks before it.
    expect(overview.querySelectorAll('[data-blank]')).toHaveLength(6)
  })

  it('shows the distribution and per-habit calendars', async () => {
    stubApi(({ url }) => (url.startsWith('/api/stats/month') ? jsonResponse(month) : undefined))
    renderWithProviders(<MonthPage />, { route: '/month' })

    expect(await screen.findByText('Green 2 (50%)')).toBeInTheDocument()
    const read = screen.getByRole('region', { name: 'Read' })
    expect(within(read).getByRole('img', { name: 'Read, Sun 1 Nov, Target hit' })).toHaveClass('bg-cell-green')
    expect(within(read).getByRole('img', { name: 'Read, Mon 2 Nov, Did nothing' })).toHaveClass('bg-cell-red')
  })

  it('moves between months', async () => {
    const fetchMock = stubApi(({ url }) => (url.startsWith('/api/stats/month') ? jsonResponse(month) : undefined))
    const { user } = renderWithProviders(<MonthPage />, { route: '/month' })

    await user.click(await screen.findByRole('button', { name: 'Next month' }))

    expect(await screen.findByRole('button', { name: 'This month' })).toBeInTheDocument()
    expect(requests(fetchMock).map((r) => r.url)).toContain('/api/stats/month?month=2026-12')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npx vitest run src/features/month`
Expected: FAIL — `./MonthPage` cannot be resolved.

- [ ] **Step 3: Implement the calendar grid**

`web/src/features/month/CalendarGrid.tsx`:
```tsx
import { dayOfMonth, weekdayIndex, WEEKDAYS } from '../../lib/dates'

export interface CalendarDay {
  date: string
  className: string
  label: string
}

/** Score → color: no score outlined, < 0.5 red, < 1.25 yellow, otherwise green (GREEN = 2, YELLOW = 1, RED/GREY = 0). */
export function scoreClass(score: number | null): string {
  if (score === null) return 'border border-muted/40'
  if (score < 0.5) return 'bg-cell-red'
  if (score < 1.25) return 'bg-cell-yellow'
  return 'bg-cell-green'
}

interface CalendarGridProps {
  days: CalendarDay[]
  showNumbers?: boolean
  compact?: boolean
}

/** One month as a Monday-first 7-column grid. */
export function CalendarGrid({ days, showNumbers = false, compact = false }: CalendarGridProps) {
  const blanks = days.length > 0 ? weekdayIndex(days[0].date) : 0
  return (
    <div className={`grid grid-cols-7 ${compact ? 'gap-0.5' : 'gap-1'}`}>
      {!compact && WEEKDAYS.map((weekday) => (
        <div key={weekday} className="text-center text-[10px]" aria-hidden="true">{weekday[0]}</div>
      ))}
      {Array.from({ length: blanks }, (_, i) => <div key={`blank-${i}`} data-blank />)}
      {days.map((day) => (
        <div key={day.date} role="img" aria-label={day.label}
          className={`aspect-square ${compact ? 'rounded-sm' : 'rounded-md p-0.5 text-[10px] font-semibold text-bg'} ${day.className}`}>
          {showNumbers && <span className={day.className.includes('border') ? 'text-muted' : ''}>{dayOfMonth(day.date)}</span>}
        </div>
      ))}
    </div>
  )
}

export default CalendarGrid
```

- [ ] **Step 4: Implement the page and route**

`web/src/features/month/MonthPage.tsx`:
```tsx
import { useSearchParams } from 'react-router'
import { addMonths, formatDay, formatMonth } from '../../lib/dates'
import { cellClass, STATE_LABEL } from '../../lib/cells'
import { useMonth } from '../stats/api'
import { DistributionBar } from '../stats/DistributionBar'
import { CalendarGrid, scoreClass } from './CalendarGrid'

const navButton = 'rounded border border-muted/30 px-2.5 py-1 text-xs'

export function MonthPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const month = searchParams.get('month') ?? undefined
  const { data, isPending, isError } = useMonth(month)

  if (isPending) return <p>Loading…</p>
  if (isError) return <p role="alert">Couldn't load this month.</p>

  const overview = data.overview.map(({ date, score }) => ({
    date,
    className: scoreClass(score),
    label: `${formatDay(date)}: ${score === null ? 'no score' : `score ${score.toFixed(1)}`}`,
  }))

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <button type="button" aria-label="Previous month" className={navButton}
          onClick={() => setSearchParams({ month: addMonths(data.month, -1) })}>◀</button>
        <h1 className="text-lg font-semibold text-accent md:text-xl">{formatMonth(data.month)}</h1>
        <button type="button" aria-label="Next month" className={navButton}
          onClick={() => setSearchParams({ month: addMonths(data.month, 1) })}>▶</button>
        {month && <button type="button" className={navButton} onClick={() => setSearchParams({})}>This month</button>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-label="Daily score" className="rounded-lg bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">All habits: daily score</h2>
          <CalendarGrid days={overview} showNumbers />
          <p className="mt-2 text-xs">Green = 2, yellow = 1, red / grey = 0, averaged over habits due that day.</p>
        </section>
        <div className="flex flex-col gap-4">
          <DistributionBar title={`${formatMonth(data.month)} distribution`} distribution={data.distribution} />
          {data.habits.length > 0 && (
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-surface p-4 sm:grid-cols-3">
              {data.habits.map((habit) => (
                <section key={habit.id} aria-label={habit.name}>
                  <h3 className="mb-1 truncate text-xs text-slate-300">{habit.name}</h3>
                  <CalendarGrid compact days={habit.cells.map(({ date, state }) => ({
                    date,
                    className: cellClass(state),
                    label: `${habit.name}, ${formatDay(date)}, ${STATE_LABEL[state]}`,
                  }))} />
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default MonthPage
```

`web/src/app/router.tsx`: import `MonthPage` and add, inside the `Shell` route:
```tsx
import { MonthPage } from '../features/month/MonthPage'
// …
        <Route path="/month" element={<MonthPage />} />
```

- [ ] **Step 5: Run tests, lint and build**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: all PASS.

> `1.25.toFixed(1)` is `"1.3"` in V8 (the test relies on it); if a runtime prints `"1.2"`, change the fixture score to `1.3` rather than the rounding.

- [ ] **Step 6: Commit**

```bash
git add web
git commit -m "feat(web): add month view with score heatmap and per-habit calendars" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: Settings (timezone, password)

Matches the Settings frame of mockup 4.

**Files:**
- Create: `web/src/features/settings/SettingsPage.tsx`
- Modify: `web/src/app/router.tsx` (add `/settings`)
- Test: `web/src/features/settings/SettingsPage.test.tsx`

**Interfaces:**
- Consumes: `useSession` (`me`, `setMe`), `browserTimezone` (Task 2); `inputClass` (Task 2); `api`, `messageFor`, `Me` (Task 1).
- Produces: `SettingsPage` at `/settings`.

- [ ] **Step 1: Write the failing test**

`web/src/features/settings/SettingsPage.test.tsx`:
```tsx
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { browserTimezone } from '../auth/session'
import { jsonResponse, problemResponse, requests, stubApi } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { SettingsPage } from './SettingsPage'

describe('SettingsPage', () => {
  it('shows the account', () => {
    stubApi(() => undefined)
    renderWithProviders(<SettingsPage />, { route: '/settings' })

    expect(screen.getByText('bob')).toBeInTheDocument()
    expect(screen.getByLabelText('Timezone')).toHaveValue('Asia/Kolkata')
  })

  it('saves the timezone, defaulting to this device', async () => {
    const fetchMock = stubApi(({ method, body }) =>
      method === 'PUT' ? jsonResponse({ username: 'bob', ...(body as object) }) : undefined,
    )
    const { user } = renderWithProviders(<SettingsPage />, { route: '/settings' })

    await user.click(screen.getByRole('button', { name: 'Use this device' }))
    expect(screen.getByLabelText('Timezone')).toHaveValue(browserTimezone())
    await user.click(screen.getByRole('button', { name: 'Save timezone' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Timezone saved')
    expect(requests(fetchMock)).toEqual([
      { method: 'PUT', url: '/api/auth/me', body: { timezone: browserTimezone() } },
    ])
  })

  it('changes the password', async () => {
    const fetchMock = stubApi(({ method }) =>
      method === 'PUT' ? jsonResponse({ username: 'bob', timezone: 'Asia/Kolkata' }) : undefined,
    )
    const { user } = renderWithProviders(<SettingsPage />, { route: '/settings' })

    await user.type(screen.getByLabelText('Current password'), 'old-password')
    await user.type(screen.getByLabelText('New password'), 'new-password')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Password changed')
    expect(screen.getByLabelText('Current password')).toHaveValue('')
    expect(requests(fetchMock)[0].body).toEqual({ currentPassword: 'old-password', newPassword: 'new-password' })
  })

  it('shows a wrong current password', async () => {
    stubApi(() => problemResponse(400, 'VALIDATION', 'currentPassword: is incorrect'))
    const { user } = renderWithProviders(<SettingsPage />, { route: '/settings' })

    await user.type(screen.getByLabelText('Current password'), 'nope-nope')
    await user.type(screen.getByLabelText('New password'), 'new-password')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('currentPassword: is incorrect')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npx vitest run src/features/settings`
Expected: FAIL — `./SettingsPage` cannot be resolved.

- [ ] **Step 3: Implement the page and route**

`web/src/features/settings/SettingsPage.tsx`:
```tsx
import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api } from '../../api/client'
import { messageFor } from '../../api/errors'
import type { Me } from '../../api/types'
import { inputClass } from '../auth/LoginPage'
import { browserTimezone, useSession } from '../auth/session'

type Feedback = { kind: 'ok' | 'error'; text: string } | null

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null
  return feedback.kind === 'ok'
    ? <p role="status" className="mt-2 text-sm text-cell-green">{feedback.text}</p>
    : <p role="alert" className="mt-2 text-sm text-red-400">{feedback.text}</p>
}

/** Every timezone the browser knows, for the datalist (empty on very old browsers). */
function timezones(): string[] {
  return typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
}

export function SettingsPage() {
  const { me, setMe } = useSession()
  const queryClient = useQueryClient()
  const [timezone, setTimezone] = useState(me?.timezone ?? '')
  const [tzFeedback, setTzFeedback] = useState<Feedback>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwFeedback, setPwFeedback] = useState<Feedback>(null)

  async function saveTimezone(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setTzFeedback(null)
    try {
      setMe(await api.put<Me>('/api/auth/me', { timezone }))
      // "Today" may have moved, so every stats view is stale.
      await queryClient.invalidateQueries({ queryKey: ['stats'] })
      setTzFeedback({ kind: 'ok', text: 'Timezone saved' })
    } catch (err) {
      setTzFeedback({ kind: 'error', text: messageFor(err) })
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setPwFeedback(null)
    try {
      setMe(await api.put<Me>('/api/auth/me', { currentPassword, newPassword }))
      setCurrentPassword('')
      setNewPassword('')
      setPwFeedback({ kind: 'ok', text: 'Password changed' })
    } catch (err) {
      setPwFeedback({ kind: 'error', text: messageFor(err) })
    }
  }

  const card = 'mb-4 rounded-lg bg-surface p-4'
  const heading = 'mb-3 text-sm font-semibold text-slate-200'
  return (
    <section className="max-w-md">
      <h1 className="mb-4 text-xl font-semibold text-accent">Settings</h1>
      <div className={card}>
        <h2 className={heading}>Account</h2>
        <p className="text-sm">Username: <b className="text-slate-200">{me?.username}</b></p>
      </div>
      <form className={card} onSubmit={(event) => void saveTimezone(event)}>
        <h2 className={heading}>Timezone</h2>
        <label htmlFor="timezone" className="sr-only">Timezone</label>
        <input id="timezone" list="timezones" required value={timezone}
          onChange={(e) => setTimezone(e.target.value)} className={`${inputClass} w-full`} />
        <datalist id="timezones">
          {timezones().map((zone) => <option key={zone} value={zone} />)}
        </datalist>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => setTimezone(browserTimezone())}
            className="rounded border border-muted/30 px-3 py-1.5 text-sm">Use this device</button>
          <button type="submit" className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-bg">Save timezone</button>
        </div>
        <FeedbackLine feedback={tzFeedback} />
      </form>
      <form className={card} onSubmit={(event) => void changePassword(event)}>
        <h2 className={heading}>Change password</h2>
        <div className="mb-3 flex flex-col gap-1">
          <label htmlFor="current-password" className="text-sm">Current password</label>
          <input id="current-password" type="password" autoComplete="current-password" required
            value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} />
        </div>
        <div className="mb-3 flex flex-col gap-1">
          <label htmlFor="new-password" className="text-sm">New password</label>
          <input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128}
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
        </div>
        <button type="submit" className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-bg">Change password</button>
        <FeedbackLine feedback={pwFeedback} />
      </form>
    </section>
  )
}

export default SettingsPage
```

`web/src/app/router.tsx`: import `SettingsPage` and add, inside the `Shell` route:
```tsx
import { SettingsPage } from '../features/settings/SettingsPage'
// …
        <Route path="/settings" element={<SettingsPage />} />
```

- [ ] **Step 4: Run tests, lint and build**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat(web): add settings for timezone and password" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: End-to-end test, Docker image, Render blueprint and README

**Files:**
- Create: `web/e2e/habit.spec.ts`, `Dockerfile`, `.dockerignore`, `render.yaml`
- Modify: `README.md` (append "Frontend" and "Deployment")

**Interfaces:**
- Consumes: every page from Tasks 2–6; cell labels from Task 4 (`"<habit>, <day>, <state label>"`, today's cell has `aria-current="date"`) and Task 5 (`role="img"`, same label format); the backend from the backend plan (`/api/public/health`, `SpaWebConfig`, `COOKIE_SECURE`, Gradle project `api`).
- Produces: the deployable image and the Render Blueprint.

- [ ] **Step 1: Write the end-to-end test**

`web/e2e/habit.spec.ts`:
```ts
import { expect, test } from '@playwright/test'

test('sign up, create a habit, mark today green and see it on week and month', async ({ page }) => {
  const username = `e2e_${Date.now()}`

  await page.goto('/signup')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByRole('link', { name: 'Create your first habit' })).toBeVisible()

  await page.getByRole('link', { name: 'Create your first habit' }).click()
  await page.getByRole('button', { name: 'New habit' }).click()
  await page.getByLabel('Name').fill('Read')
  await page.getByLabel('Bare minimum (YELLOW)').fill('1 page')
  await page.getByLabel('Target (GREEN)').fill('20 pages')
  await page.getByRole('button', { name: 'Create habit' }).click()
  await expect(page.getByRole('listitem', { name: 'Read' })).toBeVisible()

  await page.getByRole('link', { name: 'Week' }).click()
  const today = page.getByRole('button', { name: /^Read, / }).and(page.locator('[aria-current="date"]'))
  await expect(today).toHaveAccessibleName(/Not marked yet$/)
  await today.click()
  const picker = page.getByRole('dialog')
  await picker.getByRole('button', { name: /^Green/ }).click()
  await picker.getByRole('button', { name: 'Save' }).click()
  await expect(picker).toHaveCount(0)
  await expect(today).toHaveAccessibleName(/Target hit$/)
  await expect(page.getByText('Green 1 (100%)')).toBeVisible()

  await page.getByRole('link', { name: 'Month' }).click()
  await expect(page.getByRole('img', { name: /^Read, .*, Target hit$/ })).toBeVisible()
})
```

Playwright (copied config) starts only the Vite dev server, so the API must already be running with a database (see the README "Frontend" section). Each run signs up a fresh user, so it is rerunnable.

- [ ] **Step 2: Run it**

Run (three terminals, from the repo root):
```bash
cd api && docker compose up -d && set -a && . ./.env && set +a && ./gradlew bootRun
cd web && npx playwright install chromium && npm run e2e
```
Expected: `1 passed`.

- [ ] **Step 3: Add the Docker image, ignore file and Render Blueprint**

`Dockerfile` (same as `../Dionysus/Dockerfile`):
```dockerfile
# One image serving both the web app and the API (same origin, so the session cookie just works).

FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM eclipse-temurin:21-jdk-alpine AS api
WORKDIR /api
COPY api/gradlew api/settings.gradle api/build.gradle ./
COPY api/gradle gradle
RUN ./gradlew dependencies --no-daemon -q > /dev/null
COPY api/src src
COPY --from=web /web/dist src/main/resources/static
RUN ./gradlew bootJar --no-daemon -q -x test

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
USER app
COPY --from=api /api/build/libs/api-*.jar app.jar
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+UseSerialGC -Xss512k"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

`.dockerignore`:
```
**/node_modules
**/.gradle
**/build
**/.idea
**/.DS_Store
api/.env
web/dist
web/test-results
web/playwright-report
.git
docs
```

`render.yaml`:
```yaml
# Render Blueprint: one Docker web service serving the web app and the API.
# Secrets use sync: false, so Render asks for them when the Blueprint is first applied.
services:
  - type: web
    name: chronos
    runtime: docker
    plan: free
    region: singapore
    dockerfilePath: ./Dockerfile
    healthCheckPath: /api/public/health
    autoDeploy: true
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: DATABASE_USER
        sync: false
      - key: DATABASE_PASSWORD
        sync: false
```

- [ ] **Step 4: Verify the image**

Run (with the compose Postgres from Step 2 still up):
```bash
docker build -t chronos .
docker run --rm -d --name chronos-check -p 8090:8080 \
  -e DATABASE_URL=jdbc:postgresql://host.docker.internal:5433/chronos \
  -e DATABASE_USER=chronos -e DATABASE_PASSWORD=chronos -e COOKIE_SECURE=false chronos
sleep 20
curl -s localhost:8090/api/public/health
curl -s -o /dev/null -w '%{http_code}\n' localhost:8090/month
docker stop chronos-check
```
Expected: `{"status":"UP"}` then `200` (client route served by `index.html`).

> Rancher Desktop: if `docker` can't reach the daemon, export `DOCKER_HOST=unix://$HOME/.rd/docker.sock` first.

- [ ] **Step 5: Append the README sections**

Append to `README.md`:
````markdown

## Frontend (`web/`)

Vite + React 19 + TypeScript, TanStack Query, react-router, Tailwind CSS 4. Requires Node 22+.

```bash
cd web
npm install
npm run dev        # http://localhost:5173, proxies /api to the backend on :8080
npm test           # Vitest unit/component tests
npm run lint       # oxlint
npm run build      # type-check + production build into web/dist
npm run e2e        # Playwright (needs the backend running; signs up a fresh user each run)
```

Pages: **Week** (`/`, grid + picker, distribution, streaks), **Month** (`/month`), **Habits** (`/habits`),
**Settings** (`/settings`). Static mockups: `docs/superpowers/specs/2026-11-22-chronos-ui-mockups.html`.

## Deployment (one Docker service)

The root `Dockerfile` builds the web app, copies it into the API's `static/` folder and produces a single image.
Spring Boot serves the site and the API from the same origin, so the session cookie needs no CORS: client routes such
as `/month` fall back to `index.html`, `/assets/*` is cached for a year, and `/api/**` is untouched.

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
````

- [ ] **Step 6: Commit**

```bash
git add web/e2e Dockerfile .dockerignore render.yaml README.md
git commit -m "feat: add e2e test, Docker image and Render blueprint" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

- [ ] **Step 7: Hand over for a manual check**

Start the app locally and leave it running for the user:
```bash
cd api && docker compose up -d && set -a && . ./.env && set +a && ./gradlew bootRun   # :8080
cd web && npm run dev                                                                # :5173
```
Then ask the user to open http://localhost:5173, sign up, and check the week, month, habits and settings pages
against the mockups. Deploying to Render/Neon needs the user's accounts; walk them through the README steps rather
than doing it for them.
