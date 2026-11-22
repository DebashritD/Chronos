# Chronos Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Chronos web app (UI v2: dark, native-app feel) — sign up / log in, a **Today** home with one-tap Target/Minimum/Missed marking and a "time left" countdown, **Progress** (week grid + month heatmaps, distribution donut, streaks), **Habits** and **Account** — and ship it with the API as one Docker image on Render + Neon.

**Architecture:** Vite + React SPA in `web/` mirroring `../Dionysus/web`: a tiny `fetch` client with SPA CSRF handling, TanStack Query for server state, react-router routes guarded by a session context. All stats come pre-computed from `/api/stats/*`; the web app only renders them (hand-made CSS grids and a small SVG donut, no chart library). The shell is a desktop sidebar (≥ 768px) or a mobile bottom tab bar. The root `Dockerfile` bakes the built app into the Spring Boot jar.

**Tech Stack:** Node ≥ 22, Vite 8, React 19, TypeScript ~7, TanStack Query 5, react-router 8, Tailwind CSS 4, lucide-react (icons), @fontsource/inter (self-hosted Inter), Vitest + Testing Library + jsdom, Playwright, oxlint.

**Mockups:** `docs/superpowers/specs/2026-11-22-chronos-ui-mockups.html` (UI v2) is the visual source of truth.

**Spec:** `docs/superpowers/specs/2026-11-22-chronos-habit-tracker-design.md`
**Depends on:** `docs/superpowers/plans/2026-11-22-chronos-backend-api.md` (fully implemented; its JSON shapes are restated below).

## Global Constraints

- Dependency versions are copied from `../Dionysus/web/package.json` (React `^19.3.1`, react-router `^8.5.2`, TanStack Query `^5.108.0`, Vite `^8.3.6`, Vitest `^5.1.1`, TypeScript `~7.0.2`, Tailwind `^4.3.5`, Playwright `^1.65.1`, oxlint `^1.90.0`). Add no other runtime dependencies besides `@fontsource/inter` (`^5.3.0`) and `lucide-react` (`^1.77.0`).
- Dates travel as ISO strings (`YYYY-MM-DD`, months `YYYY-MM`) and are never converted to local `Date`s for logic; date math uses UTC (`src/lib/dates.ts`).
- Week starts Monday. The API decides "today" and editability; the UI never re-derives them.
- Dark theme only. Colors are Tailwind theme tokens defined once in `src/index.css` (`bg`, `card`, `surface`, `line`, `fg`, `muted`, `dim`, `accent`, `urgent`, `outline`, `cell-green|yellow|red|grey`, `score-0…4`); components use the token utilities (`bg-card`, `text-muted`, …), never raw hex. GREEN/YELLOW/RED as named; GREY = unmarked; PENDING outlined; PAUSED hatched; NOT_DUE blank.
- Shared class strings (cards, buttons, inputs, titles) live in `src/lib/ui.ts` (Task 2).
- Routes: `/` Today, `/progress` (Week; `?view=month` for Month, `?start=` / `?month=` to navigate), `/habits`, `/settings` (labelled **Account**), `/login`, `/signup`. There is no `/month` route.
- Animations/transitions are disabled under `prefers-reduced-motion: reduce` (global rule in `index.css`).
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
  targetText: string; frequency: Frequency; intervalDays: number | null; cells: { date: string; periodStart: string | null;
  state: CellState; editable: boolean; note: string | null; closesAt: string | null }[] }[] }
// closesAt: UTC instant ("2026-11-18T18:30:00Z") when the cell's period ends (start of the day after its last day,
// in the user's timezone); null for NOT_DUE cells. Drives the Today countdown.
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

### Task 1: Scaffold, design tokens, API client and date helpers

**Files:**
- Create: `web/package.json`, `web/index.html`, `web/public/favicon.svg`, `web/src/main.tsx`, `web/src/App.tsx`, `web/src/index.css`
- Copy from `../Dionysus/web`: `.gitignore`, `.oxlintrc.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `playwright.config.ts`, `src/api/{client,client.test,pending,queryClient,queryErrorBridge}.ts`, `src/app/{WakingNotice,WakingNotice.test}.tsx`
- Create: `web/src/api/{errors,types}.ts`, `web/src/lib/{dates,cells}.ts`, `web/src/test/{setup,http}.ts`
- Test: `web/src/api/errors.test.ts`, `web/src/lib/dates.test.ts`, `web/src/lib/cells.test.ts`

**Interfaces:**
- Produces:
  - `api.get<T>(path, params?)`, `api.post<T>(path, body?)`, `api.put<T>(path, body)`, `api.del(path)`, `clearCsrf()` (copied client)
  - `ApiError { status; code; detail }`, `messageFor(error: unknown): string`
  - `createQueryClient(queryDefaults?)`, `setQueryErrorHandler(handler | null)`
  - Types in `src/api/types.ts`: `Me`, `Frequency`, `HabitStatus`, `Habit`, `NewHabit`, `HabitTexts`, `Color`, `CellState`, `Distribution`, `WeekView`, `WeekHabit`, `WeekCell`, `MonthView`, `MonthHabit`, `Streak`
  - `src/index.css` theme tokens (see Global Constraints) plus the `.cell-paused` and `.logo-tile` classes
  - `src/lib/dates.ts`: `addDays(iso, n)`, `addMonths(ym, n)`, `weekdayIndex(iso)` (Mon = 0), `dayOfMonth(iso)`, `formatDay(iso)` (`"Wed 18 Nov"`), `formatLongDay(iso)` (`"Wednesday, 18 Nov"`), `formatWeekRange(start)` (`"16 – 22 Nov 2026"`), `formatMonth(ym)` (`"November 2026"`), `WEEKDAYS` (`['Mon', …, 'Sun']`)
  - `src/lib/cells.ts`: `cellClass(state)`, `STATE_LABEL: Record<CellState, string>`, `isColor(state)`, `frequencyLabel(frequency, intervalDays?)`, `habitSummary(habit)` (`"Daily · 1 page → 20 pages"`)
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
    "@fontsource/inter": "^5.3.0",
    "@tanstack/react-query": "^5.108.0",
    "lucide-react": "^1.77.0",
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
    <meta name="theme-color" content="#0a0a0f" />
    <meta name="color-scheme" content="dark" />
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
  <rect width="64" height="64" rx="14" fill="#0a0a0f"/>
  <rect x="10" y="24" width="13" height="16" rx="4" fill="#ff453a"/>
  <rect x="25.5" y="24" width="13" height="16" rx="4" fill="#ffd60a"/>
  <rect x="41" y="24" width="13" height="16" rx="4" fill="#30d158"/>
</svg>
```

`web/src/index.css`:
```css
@import "tailwindcss";

/* UI v2 design tokens (dark only). `surface` is the raised "card2" tone and `muted` the secondary text, so the
   copied WakingNotice (bg-surface / text-muted) matches without changes. */
@theme {
  --color-bg: #0a0a0f;
  --color-card: #15151d;
  --color-surface: #1c1c26;
  --color-line: rgb(255 255 255 / 0.06);
  --color-fg: #f4f4f7;
  --color-muted: #8e8e9a;
  --color-dim: #5a5a66;
  --color-accent: #7c8cff;
  --color-urgent: #ff9f0a;
  --color-outline: #34343f;
  --color-cell-green: #30d158;
  --color-cell-yellow: #ffd60a;
  --color-cell-red: #ff453a;
  --color-cell-grey: #2c2c36;
  /* Month daily-score scale, red → green */
  --color-score-0: #ff453a;
  --color-score-1: #ff8a3d;
  --color-score-2: #ffd60a;
  --color-score-3: #7ed957;
  --color-score-4: #30d158;
  --radius-card: 22px;
  --radius-cell: 10px;
  --font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
}

:root {
  color-scheme: dark;
}

body {
  background-color: var(--color-bg);
  color: var(--color-fg);
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}

/* PAUSED cells: diagonal hatching */
.cell-paused {
  background: repeating-linear-gradient(135deg, #26262f 0 4px, #1a1a22 4px 8px);
}

/* The app logo: a rounded tile with a red → yellow → green → accent sweep */
.logo-tile {
  background: conic-gradient(from 210deg, var(--color-cell-red), var(--color-cell-yellow), var(--color-cell-green), var(--color-accent), var(--color-cell-red));
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

`web/src/App.tsx` (replaced by the router in Task 2):
```tsx
function App() {
  return <h1 className="p-4 text-xl font-bold text-fg">Chronos</h1>
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
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
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
import { addDays, addMonths, dayOfMonth, formatDay, formatLongDay, formatMonth, formatWeekRange, weekdayIndex } from './dates'

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
    expect(formatLongDay('2026-11-18')).toBe('Wednesday, 18 Nov')
    expect(formatWeekRange('2026-11-16')).toBe('16 – 22 Nov 2026')
    expect(formatWeekRange('2026-11-30')).toBe('30 Nov – 6 Dec 2026')
    expect(formatMonth('2026-11')).toBe('November 2026')
  })
})
```

`web/src/lib/cells.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { habitSummary, isColor } from './cells'

describe('cells', () => {
  it('summarises a habit as frequency · minimum → target', () => {
    expect(habitSummary({ frequency: 'DAILY', minText: '1 page', targetText: '20 pages' })).toBe('Daily · 1 page → 20 pages')
    expect(habitSummary({ frequency: 'EVERY_N_DAYS', intervalDays: 3, minText: '1 km', targetText: '5 km' })).toBe(
      'Every 3 days · 1 km → 5 km',
    )
    expect(habitSummary({ frequency: 'WEEKLY', minText: '5 min', targetText: '30 min' })).toBe('Weekly · 5 min → 30 min')
  })

  it('knows which states are marked colors', () => {
    expect(isColor('YELLOW')).toBe(true)
    expect(isColor('PENDING')).toBe(false)
    expect(isColor('GREY')).toBe(false)
  })
})
```

- [ ] **Step 5: Run them to verify they fail**

Run: `cd web && npm test`
Expected: FAIL — `./errors`, `./dates` and `./cells` cannot be resolved (the copied `client.test.ts` also fails until `errors.ts` exists).

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
  /** UTC instant when the cell's period ends (start of the next day in the user's timezone); null when NOT_DUE. */
  closesAt: string | null
}

export interface WeekHabit extends HabitTexts {
  id: number
  frequency: Frequency
  intervalDays: number | null
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
const longWeekdayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long' })
const dayMonthFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })
const monthFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })

/** "Wed 18 Nov" */
export function formatDay(iso: string): string {
  return dayFormat.format(parse(iso)).replace(',', '')
}

/** "Wednesday, 18 Nov" (the Today eyebrow) */
export function formatLongDay(iso: string): string {
  return `${longWeekdayFormat.format(parse(iso))}, ${dayMonthFormat.format(parse(iso))}`
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
import type { CellState, Color, Frequency, HabitTexts } from '../api/types'

export const STATE_LABEL: Record<CellState, string> = {
  GREEN: 'Target hit',
  YELLOW: 'Minimum done',
  RED: 'Missed',
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
      return 'border-[1.5px] border-outline'
    case 'PAUSED':
      return 'cell-paused'
    case 'NOT_DUE':
      return 'bg-transparent'
  }
}

export function isColor(state: CellState): state is Color {
  return state === 'GREEN' || state === 'YELLOW' || state === 'RED'
}

export function frequencyLabel(frequency: Frequency, intervalDays?: number | null): string {
  switch (frequency) {
    case 'DAILY':
      return 'Daily'
    case 'WEEKLY':
      return 'Weekly'
    case 'EVERY_N_DAYS':
      return `Every ${intervalDays} days`
  }
}

/** "Daily · 1 page → 20 pages" */
export function habitSummary(
  habit: Pick<HabitTexts, 'minText' | 'targetText'> & { frequency: Frequency; intervalDays?: number | null },
): string {
  return `${frequencyLabel(habit.frequency, habit.intervalDays)} · ${habit.minText} → ${habit.targetText}`
}
```

- [ ] **Step 7: Run tests, lint and build**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: all tests PASS (errors, dates, cells, copied client and WakingNotice tests); lint has no errors; build writes `web/dist/`.

> If `formatDay` yields `"Wed, 18 Nov"` with a comma in another position, keep the `.replace(',', '')`; the test is the contract.

- [ ] **Step 8: Commit**

```bash
git add web
git commit -m "feat(web): scaffold Vite app with design tokens, API client and date helpers" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Session, login, sign-up, guarded routes and app shell (sidebar + tab bar)

Matches the "Log in" frame and the shell (desktop sidebar, mobile tab bar) of the mockups.

**Files:**
- Create: `web/src/features/auth/{session,AuthLayout,LoginPage,SignupPage}.tsx`, `web/src/app/{router,Shell,Logo,NotFound}.tsx`, `web/src/lib/ui.ts`, `web/src/test/utils.tsx`
- Modify: `web/src/App.tsx`, `web/src/main.tsx`
- Test: `web/src/features/auth/{LoginPage,SignupPage}.test.tsx`, `web/src/app/router.test.tsx`

**Interfaces:**
- Consumes: `api`, `clearCsrf`, `ApiError`, `messageFor`, `setQueryErrorHandler`, `createQueryClient`, `Me` (Task 1); `stubApi`, `jsonResponse`, `problemResponse`, `requests` (Task 1).
- Produces:
  - `SessionProvider({ children, initialMe? })` — without `initialMe` it calls `GET /api/auth/me` on mount; with it (tests) it skips the check.
  - `useSession(): { me: Me | null; checking: boolean; login(username, password); signup(username, password); logout(); setMe(me: Me) }`
  - `browserTimezone(): string`
  - `src/lib/ui.ts`: class strings `card`, `cardTitle`, `pageTitle`, `eyebrow`, `inputClass`, `primaryButton`, `secondaryButton`, `pillButton`
  - `Logo({ size? })`, `AuthLayout({ title, children })` (a visually hidden `<h2>` carries `title`)
  - `Shell`: desktop `<aside>` with the logo, `nav` "Primary" and a user chip (initial, username, timezone); mobile `nav` "Tabs" fixed at the bottom. Both navs link Today `/`, Progress `/progress`, Habits `/habits`, Account `/settings`. No logout here (it lives on Account, Task 7).
  - `AppRouter` with routes `/login`, `/signup` (guests only) and, inside `Shell` (signed-in only), `/` plus a `*` NotFound. Later tasks add `/habits` (Task 3), `/progress` (Task 4), replace `/` with Today (Task 5) and add `/settings` (Task 7).
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
  it('logs in and goes to Today', async () => {
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
import { jsonResponse, problemResponse, stubApi } from '../test/http'
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
    // Both navs are in the DOM (CSS hides one per breakpoint).
    for (const name of ['Today', 'Progress', 'Habits', 'Account']) {
      expect(screen.getAllByRole('link', { name })).toHaveLength(2)
    }
    expect(screen.getByRole('navigation', { name: 'Tabs' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Today' })[0]).toHaveAttribute('aria-current', 'page')
  })

  it('keeps signed-in users away from the login page', async () => {
    stubApi(() => undefined)
    renderWithProviders(<AppRouter />, { route: '/login', path: '/*' })

    expect(await screen.findByText('bob')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Log in' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run them to verify they fail**

Run: `cd web && npm test`
Expected: FAIL — `./session`, `./LoginPage`, `./SignupPage`, `./router` cannot be resolved.

> Logging out is tested with the Account page (Task 7), where the button lives.

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

- [ ] **Step 5: Implement the shared styles, logo and auth pages**

`web/src/lib/ui.ts`:
```ts
/** Shared Tailwind class strings for the v2 look. Colors come from the theme tokens in index.css. */
export const card = 'rounded-card border border-line bg-card p-5'
export const cardTitle = 'mb-3 text-[15px] font-semibold text-fg'
export const pageTitle = 'text-[34px] leading-tight font-extrabold tracking-tight text-fg'
export const eyebrow = 'text-[13px] font-medium tracking-[0.06em] text-muted uppercase'
export const inputClass =
  'w-full rounded-[14px] border border-line bg-surface px-4 py-3 text-[15px] text-fg placeholder:text-dim focus:border-accent focus:outline-none'
export const primaryButton =
  'rounded-[14px] bg-accent px-4 py-3 text-[15px] font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50'
export const secondaryButton =
  'rounded-[14px] border border-line bg-surface px-4 py-3 text-[15px] font-medium text-fg disabled:opacity-50'
export const pillButton =
  'rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-fg disabled:opacity-50'
```

`web/src/app/Logo.tsx`:
```tsx
/** The conic-gradient tile; `md` adds the "Chronos" wordmark (sidebar), `lg` is the tile alone (auth pages). */
export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  if (size === 'lg') {
    return <span className="logo-tile block h-14 w-14 rounded-[18px]" aria-hidden="true" />
  }
  return (
    <span className="flex items-center gap-2.5">
      <span className="logo-tile block h-8 w-8 rounded-[10px]" aria-hidden="true" />
      <span className="text-[17px] font-bold tracking-tight text-fg">Chronos</span>
    </span>
  )
}

export default Logo
```

`web/src/features/auth/AuthLayout.tsx`:
```tsx
import type { ReactNode } from 'react'
import { Logo } from '../../app/Logo'

/** Shared frame for log-in and sign-up: logo tile, headline, tagline, then the form. */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 py-10">
      <div className="w-full max-w-sm">
        <Logo size="lg" />
        <h1 className="mt-7 text-[34px] leading-[1.1] font-extrabold tracking-tight text-fg">
          Never two reds<br />in a row.
        </h1>
        <p className="mt-2.5 mb-7 text-[15px] leading-normal text-muted">
          Mark each habit green, yellow or red. Keep the chain alive.
        </p>
        <h2 className="sr-only">{title}</h2>
        {children}
      </div>
    </main>
  )
}

export default AuthLayout
```

`web/src/features/auth/LoginPage.tsx`:
```tsx
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { messageFor } from '../../api/errors'
import { inputClass, primaryButton } from '../../lib/ui'
import { AuthLayout } from './AuthLayout'
import { useSession } from './session'

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
    <AuthLayout title="Log in">
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-2.5">
        <label htmlFor="username" className="sr-only">Username</label>
        <input id="username" autoComplete="username" placeholder="Username" value={username}
          onChange={(e) => setUsername(e.target.value)} className={inputClass} />
        <label htmlFor="password" className="sr-only">Password</label>
        <input id="password" type="password" autoComplete="current-password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        {error && <p role="alert" className="text-sm text-cell-red">{error}</p>}
        <button type="submit" disabled={submitting} className={`${primaryButton} mt-2 w-full`}>Log in</button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        New here? <Link to="/signup" className="font-semibold text-accent">Create an account</Link>
      </p>
    </AuthLayout>
  )
}

export default LoginPage
```

`web/src/features/auth/SignupPage.tsx`:
```tsx
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { messageFor } from '../../api/errors'
import { inputClass, primaryButton } from '../../lib/ui'
import { AuthLayout } from './AuthLayout'
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
    <AuthLayout title="Sign up">
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-2.5">
        <label htmlFor="username" className="sr-only">Username</label>
        <input id="username" autoComplete="username" placeholder="Username" value={username} minLength={3}
          maxLength={32} onChange={(e) => setUsername(e.target.value)} className={inputClass} />
        <span className="px-1 text-xs text-dim">3–32 letters, digits, “_”, “.” or “-”</span>
        <label htmlFor="password" className="sr-only">Password</label>
        <input id="password" type="password" autoComplete="new-password" placeholder="Password" value={password}
          minLength={8} maxLength={128} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        <span className="px-1 text-xs text-dim">At least 8 characters</span>
        <p className="px-1 text-xs text-muted">Timezone: {browserTimezone()} (change it later in Account)</p>
        {error && <p role="alert" className="text-sm text-cell-red">{error}</p>}
        <button type="submit" disabled={submitting} className={`${primaryButton} mt-2 w-full`}>Sign up</button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        Have an account? <Link to="/login" className="font-semibold text-accent">Log in</Link>
      </p>
    </AuthLayout>
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
      <h1 className="mb-2 text-xl font-bold text-fg">Page not found</h1>
      <Link to="/" className="font-semibold text-accent">Back to Today</Link>
    </div>
  )
}

export default NotFound
```

`web/src/app/Shell.tsx`:
```tsx
import { CircleCheck, LayoutGrid, List, UserRound, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { useSession } from '../features/auth/session'
import { Logo } from './Logo'
import { WakingNotice } from './WakingNotice'

const NAV: { to: string; label: string; icon: LucideIcon; end: boolean }[] = [
  { to: '/', label: 'Today', icon: CircleCheck, end: true },
  { to: '/progress', label: 'Progress', icon: LayoutGrid, end: false },
  { to: '/habits', label: 'Habits', icon: List, end: false },
  { to: '/settings', label: 'Account', icon: UserRound, end: false },
]

function sideClass({ isActive }: { isActive: boolean }): string {
  return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${
    isActive ? 'bg-surface text-fg' : 'text-muted hover:text-fg'
  }`
}

function tabClass({ isActive }: { isActive: boolean }): string {
  return `flex flex-1 flex-col items-center gap-1 pt-2 text-[11px] font-medium ${isActive ? 'text-accent' : 'text-dim'}`
}

/** Desktop: fixed sidebar with a user chip. Mobile (< 768px): bottom tab bar. Logout lives on Account. */
export function Shell() {
  const { me } = useSession()

  return (
    <div className="min-h-screen bg-bg text-fg md:flex">
      <aside className="sticky top-0 hidden h-screen w-60 flex-none flex-col border-r border-line px-4 py-6 md:flex">
        <div className="mb-8 px-2"><Logo /></div>
        <nav aria-label="Primary" className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={sideClass}>
              <Icon size={20} strokeWidth={2} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-2xl bg-card p-3">
          <span aria-hidden="true"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-linear-to-br from-accent to-[#bf5af2] text-sm font-bold text-white">
            {me?.username.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-fg">{me?.username}</span>
            <span className="block truncate text-xs text-muted">{me?.timezone}</span>
          </span>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-10 md:pt-10 md:pb-10">
        <Outlet />
      </main>
      <WakingNotice />
      <nav aria-label="Tabs"
        className="fixed inset-x-0 bottom-0 z-10 flex h-[calc(4rem+env(safe-area-inset-bottom))] border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={tabClass}>
            <Icon size={24} strokeWidth={2} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default Shell
```

> The copied `WakingNotice` sits at `bottom-[4.5rem]` on phones, which clears the 4rem tab bar.

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

/** Temporary home page; Task 5 replaces it with Today. */
function Welcome() {
  const { me } = useSession()
  return <p className="text-muted">Welcome, {me?.username}.</p>
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
git commit -m "feat(web): add session, restyled login and sign-up, and app shell" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Habits page (create, edit, pause/resume, archive/unarchive)

Matches the "Habits" frame of the mockups: list rows with name + "Daily · 5 → 20 pages", paused/archived rows dimmed, a floating + button on phones.

**Files:**
- Create: `web/src/features/habits/{api.ts,HabitForm.tsx,HabitsPage.tsx}`
- Modify: `web/src/app/router.tsx` (add the `/habits` route)
- Test: `web/src/features/habits/HabitsPage.test.tsx`

**Interfaces:**
- Consumes: `api`, `messageFor`, `Habit`, `HabitStatus`, `HabitTexts`, `NewHabit` (Task 1); `habitSummary` (Task 1); `card`, `eyebrow`, `inputClass`, `pageTitle`, `pillButton`, `primaryButton`, `secondaryButton` (Task 2); `renderWithProviders`, `stubApi`, `jsonResponse`, `problemResponse`, `requests` (Tasks 1–2).
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
    expect(within(readRow).getByText('Daily · 1 page → 20 pages')).toBeInTheDocument()
    const runRow = screen.getByRole('listitem', { name: 'Run' })
    expect(within(runRow).getByText('Every 3 days · 1 km → 5 km')).toBeInTheDocument()
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
import { card, inputClass, primaryButton, secondaryButton } from '../../lib/ui'

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

  const field = 'mb-3 flex flex-col gap-1.5'
  const label = 'text-[13px] font-medium text-muted'
  return (
    <form onSubmit={(event) => void handleSubmit(event)} className={`${card} mb-4`}>
      <div className={field}>
        <label htmlFor="habit-name" className={label}>Name</label>
        <input id="habit-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)}
          className={inputClass} />
      </div>
      <div className={field}>
        <label htmlFor="habit-min" className={label}>Bare minimum (YELLOW)</label>
        <input id="habit-min" required maxLength={200} value={minText} onChange={(e) => setMinText(e.target.value)}
          className={inputClass} />
      </div>
      <div className={field}>
        <label htmlFor="habit-target" className={label}>Target (GREEN)</label>
        <input id="habit-target" required maxLength={200} value={targetText}
          onChange={(e) => setTargetText(e.target.value)} className={inputClass} />
      </div>
      {!habit && (
        <>
          <div className={field}>
            <label htmlFor="habit-frequency" className={label}>Frequency</label>
            <select id="habit-frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}
              className={inputClass}>
              <option value="DAILY">Daily</option>
              <option value="EVERY_N_DAYS">Every N days</option>
              <option value="WEEKLY">Weekly (once per Mon–Sun week)</option>
            </select>
          </div>
          {frequency === 'EVERY_N_DAYS' && (
            <div className={field}>
              <label htmlFor="habit-interval" className={label}>Every how many days?</label>
              <input id="habit-interval" type="number" min={2} max={365} required value={intervalDays}
                onChange={(e) => setIntervalDays(e.target.value)} className={inputClass} />
            </div>
          )}
          <div className={field}>
            <label htmlFor="habit-start" className={label}>Start date (optional, defaults to today)</label>
            <input id="habit-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className={inputClass} />
          </div>
        </>
      )}
      {error && <p role="alert" className="mb-3 text-sm text-cell-red">{error}</p>}
      <div className="mt-1 flex gap-2">
        <button type="submit" disabled={submitting} className={primaryButton}>{submitLabel}</button>
        <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
      </div>
    </form>
  )
}

export default HabitForm
```

- [ ] **Step 5: Implement the page and route**

`web/src/features/habits/HabitsPage.tsx`:
```tsx
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { messageFor } from '../../api/errors'
import type { Habit } from '../../api/types'
import { habitSummary } from '../../lib/cells'
import { eyebrow, pageTitle, pillButton } from '../../lib/ui'
import { useCreateHabit, useHabitAction, useHabits, useUpdateHabit, type HabitAction } from './api'
import { HabitForm } from './HabitForm'

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
    const isPaused = habit.status === 'PAUSED'
    return (
      <li key={habit.id} aria-label={habit.name}
        className={`flex flex-wrap items-center gap-3 px-4 py-3.5 ${isArchived || isPaused ? 'opacity-60' : ''}`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[16px] font-semibold text-fg">{habit.name}</span>
            {isPaused && (
              <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
                Paused
              </span>
            )}
          </div>
          <p className="truncate text-[13px] text-muted">{habitSummary(habit)}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {isArchived ? (
            <button type="button" aria-label={`Unarchive ${habit.name}`} className={pillButton}
              onClick={() => void act(habit.id, 'unarchive')}>Unarchive</button>
          ) : (
            <>
              <button type="button" aria-label={`Edit ${habit.name}`} className={pillButton}
                onClick={() => setEditingId(habit.id)}>Edit</button>
              {isPaused ? (
                <button type="button" aria-label={`Resume ${habit.name}`} className={pillButton}
                  onClick={() => void act(habit.id, 'resume')}>Resume</button>
              ) : (
                <button type="button" aria-label={`Pause ${habit.name}`} className={pillButton}
                  onClick={() => void act(habit.id, 'pause')}>Pause</button>
              )}
              <button type="button" aria-label={`Archive ${habit.name}`} className={pillButton}
                onClick={() => void act(habit.id, 'archive')}>Archive</button>
            </>
          )}
        </div>
      </li>
    )
  }

  const list = 'divide-y divide-line overflow-hidden rounded-card border border-line bg-card'
  return (
    <section className="max-w-3xl">
      <div className="mb-6 flex items-end justify-between">
        <h1 className={pageTitle}>Habits</h1>
        {!creating && (
          <button type="button" aria-label="New habit" onClick={() => setCreating(true)}
            className="fixed right-5 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg shadow-accent/30 md:static md:h-auto md:w-auto md:gap-2 md:rounded-[14px] md:px-4 md:py-2.5 md:text-sm md:font-semibold md:shadow-none">
            <Plus size={24} strokeWidth={2.5} aria-hidden="true" />
            <span className="hidden md:inline">New habit</span>
          </button>
        )}
      </div>
      {creating && (
        <HabitForm submitLabel="Create habit" onCancel={() => setCreating(false)}
          onSubmit={async (values) => {
            await createHabit.mutateAsync(values)
            setCreating(false)
          }} />
      )}
      {error && <p role="alert" className="mb-3 text-sm text-cell-red">{error}</p>}
      {current.isPending && <p className="text-muted">Loading…</p>}
      {current.data?.length === 0 && !creating && <p className="text-muted">No habits yet. Create your first one.</p>}
      {current.data && current.data.length > 0 && <ul className={list}>{current.data.map(row)}</ul>}
      {archived.data && archived.data.length > 0 && (
        <details className="mt-8">
          <summary className={`${eyebrow} cursor-pointer`}>Archived ({archived.data.length})</summary>
          <ul className={`${list} mt-3`}>{archived.data.map(row)}</ul>
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

### Task 4: Progress — week view (grid, cell picker, distribution donut, streaks)

Matches the "Progress · Week" frames of `docs/superpowers/specs/2026-11-22-chronos-ui-mockups.html`: squircle cells, today's day number in an accent circle, weekly habits spanning all 7 columns, a distribution donut with legend counts and a Streaks card.

**Files:**
- Create: `web/src/features/stats/{api.ts,DistributionDonut.tsx,StreakList.tsx}`, `web/src/features/checkin/{period.ts,CellPicker.tsx}`, `web/src/features/progress/{WeekGrid,WeekPanel,ProgressPage}.tsx`
- Modify: `web/src/app/router.tsx` (add `/progress`)
- Test: `web/src/features/stats/DistributionDonut.test.tsx`, `web/src/features/progress/WeekPanel.test.tsx`

**Interfaces:**
- Consumes: `api`, `messageFor`, `Color`, `Distribution`, `Streak`, `WeekView`, `WeekHabit`, `WeekCell`, `MonthView` (Task 1); `addDays`, `dayOfMonth`, `formatDay`, `formatWeekRange`, `WEEKDAYS` (Task 1); `cellClass`, `isColor`, `STATE_LABEL` (Task 1); `card`, `cardTitle`, `eyebrow`, `inputClass`, `pageTitle`, `pillButton`, `primaryButton`, `secondaryButton` (Task 2); `renderWithProviders`, test http helpers (Tasks 1–2).
- Produces:
  - `useWeek(start?: string)` (key `['stats', 'week', start ?? 'current']`), `useMonth(month?: string)` (key `['stats', 'month', month ?? 'current']`), `useStreaks()` (key `['stats', 'streaks']`)
  - `useSaveCheckIn()` (variables `{ habitId: number; periodStart: string; color: Color; note: string | null }`), `useClearCheckIn()` (variables `{ habitId: number; periodStart: string }`) — both invalidate `['stats']` and resolve only after the refetch, so the UI never flashes the old state.
  - `periodLabel(habit, cell)` (`"Wed 18 Nov"` / `"week of Mon 16 Nov"`), `coversToday(habit, cell, today)`
  - `CellPicker({ habit, cell, onClose })` — dialog named `"<habit>, <period>"`, choices `Target hit` / `Minimum done` / `Missed` (`aria-pressed`), `Note (optional)`, Clear (only when marked) / Cancel / Save. Reused by Task 5.
  - `WeekGrid({ start, today, habits, onPick })` — cell buttons labelled `"<habit>, <Wed 18 Nov>, <state label>"` (weekly: `"<habit>, week of <Mon 16 Nov>, <state label>"`), today's cell has `aria-current="date"`. Reused by Task 5; the e2e test (Task 8) relies on the labels.
  - `DistributionDonut({ title, distribution })` — `region` named `title`, legend items named `"Green 2"`, `"Yellow 1"`, `"Red 1"`, `"Unmarked 0"`. Reused by Task 6.
  - `StreakList()` — `region` "Streaks", one `listitem` per habit named after it (`"12 · best 20"`). Reused by Task 5.
  - `WeekPanel` (reads/writes `?start=YYYY-MM-DD`) and `ProgressPage` at `/progress` (Task 6 adds the Week | Month switch).

- [ ] **Step 1: Write the failing tests**

`web/src/features/stats/DistributionDonut.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DistributionDonut } from './DistributionDonut'

describe('DistributionDonut', () => {
  it('shows each color with its count and the green share in the middle', () => {
    render(<DistributionDonut title="This week" distribution={{ green: 2, yellow: 1, red: 1, grey: 0, total: 4 }} />)

    const section = screen.getByRole('region', { name: 'This week' })
    expect(within(section).getByRole('heading', { name: 'This week' })).toBeInTheDocument()
    expect(within(section).getByRole('listitem', { name: 'Green 2' })).toBeInTheDocument()
    expect(within(section).getByRole('listitem', { name: 'Yellow 1' })).toBeInTheDocument()
    expect(within(section).getByRole('listitem', { name: 'Red 1' })).toBeInTheDocument()
    expect(within(section).getByRole('listitem', { name: 'Unmarked 0' })).toBeInTheDocument()
    expect(within(section).getByText('50%')).toBeInTheDocument()
  })

  it('says when nothing is marked', () => {
    render(<DistributionDonut title="This week" distribution={{ green: 0, yellow: 0, red: 0, grey: 0, total: 0 }} />)

    expect(screen.getByText('Nothing marked yet')).toBeInTheDocument()
  })
})
```

`web/src/features/progress/WeekPanel.test.tsx`:
```tsx
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Streak, WeekCell, WeekView } from '../../api/types'
import { jsonResponse, problemResponse, requests, stubApi, type ApiRequest } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { WeekPanel } from './WeekPanel'

const days = ['16', '17', '18', '19', '20', '21', '22'].map((d) => `2026-11-${d}`)

function daily(states: WeekCell['state'][]): WeekCell[] {
  return days.map((date, i) => ({
    date,
    periodStart: date,
    state: states[i],
    editable: date <= '2026-11-18',
    note: i === 0 ? 'great' : null,
    closesAt: `${date}T18:30:00Z`,
  }))
}

const week: WeekView = {
  start: '2026-11-16',
  today: '2026-11-18',
  distribution: { green: 1, yellow: 0, red: 1, grey: 0, total: 2 },
  habits: [
    { id: 1, name: 'Read', minText: '1 page', targetText: '20 pages', frequency: 'DAILY', intervalDays: null,
      cells: daily(['GREEN', 'RED', 'PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING']) },
    { id: 2, name: 'Piano', minText: '5 min', targetText: '30 min', frequency: 'WEEKLY', intervalDays: null,
      cells: [{ date: '2026-11-16', periodStart: '2026-11-16', state: 'PENDING', editable: true, note: null,
        closesAt: '2026-11-22T18:30:00Z' }] },
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

describe('WeekPanel', () => {
  it('shows the grid, distribution and streaks', async () => {
    api()
    renderWithProviders(<WeekPanel />, { route: '/progress' })

    expect(await screen.findByRole('heading', { name: '16 – 22 Nov 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Read, Mon 16 Nov, Target hit' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Read, Tue 17 Nov, Missed' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Read, Thu 19 Nov, Not marked yet' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Piano, week of Mon 16 Nov, Not marked yet' })).toBeEnabled()
    expect(screen.getByRole('button', { name: /^Piano/ }).closest('td')).toHaveAttribute('colspan', '7')
    const distribution = screen.getByRole('region', { name: 'This week' })
    expect(within(distribution).getByRole('listitem', { name: 'Green 1' })).toBeInTheDocument()
    expect(within(distribution).getByRole('listitem', { name: 'Red 1' })).toBeInTheDocument()
    const streakList = screen.getByRole('region', { name: 'Streaks' })
    expect(await within(streakList).findByRole('listitem', { name: 'Read' })).toHaveTextContent('0 · best 9')
  })

  it("marks today's cells", async () => {
    api()
    renderWithProviders(<WeekPanel />, { route: '/progress' })

    expect(await screen.findByRole('button', { name: 'Read, Wed 18 Nov, Not marked yet' })).toHaveAttribute('aria-current', 'date')
    expect(screen.getByRole('button', { name: /^Piano/ })).toHaveAttribute('aria-current', 'date')
    expect(screen.getByRole('button', { name: /^Read, Tue/ })).not.toHaveAttribute('aria-current')
  })

  it('saves a color with a note', async () => {
    const fetchMock = api((r) => (r.method === 'PUT' ? jsonResponse({ periodStart: '2026-11-18', color: 'GREEN', note: 'ch 4' }) : undefined))
    const { user } = renderWithProviders(<WeekPanel />, { route: '/progress' })

    await user.click(await screen.findByRole('button', { name: 'Read, Wed 18 Nov, Not marked yet' }))
    const dialog = screen.getByRole('dialog', { name: 'Read, Wed 18 Nov' })
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: /^Target hit/ })).toHaveTextContent('20 pages')
    expect(within(dialog).getByRole('button', { name: /^Minimum done/ })).toHaveTextContent('1 page')
    expect(within(dialog).getByRole('button', { name: /^Missed/ })).toHaveTextContent("Didn't do it")
    await user.click(within(dialog).getByRole('button', { name: /^Target hit/ }))
    await user.type(within(dialog).getByLabelText('Note (optional)'), 'ch 4')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(requests(fetchMock).find((r) => r.method === 'PUT')).toEqual({
      method: 'PUT',
      url: '/api/habits/1/check-ins/2026-11-18',
      body: { color: 'GREEN', note: 'ch 4' },
    })
    expect(requests(fetchMock).filter((r) => r.url.startsWith('/api/stats/week')).length).toBeGreaterThan(1)
  })

  it('opens with the current color and note, and clears', async () => {
    const fetchMock = api((r) => (r.method === 'DELETE' ? new Response(null, { status: 204 }) : undefined))
    const { user } = renderWithProviders(<WeekPanel />, { route: '/progress' })

    await user.click(await screen.findByRole('button', { name: 'Read, Mon 16 Nov, Target hit' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: /^Target hit/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByLabelText('Note (optional)')).toHaveValue('great')
    await user.click(within(dialog).getByRole('button', { name: 'Clear' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(requests(fetchMock).find((r) => r.method === 'DELETE')?.url).toBe('/api/habits/1/check-ins/2026-11-16')
  })

  it('has no Clear for unmarked periods and closes on Cancel', async () => {
    api()
    const { user } = renderWithProviders(<WeekPanel />, { route: '/progress' })

    await user.click(await screen.findByRole('button', { name: /^Piano/ }))
    expect(screen.getByRole('dialog', { name: 'Piano, week of Mon 16 Nov' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows save errors in the picker', async () => {
    api((r) => (r.method === 'PUT' ? problemResponse(422, 'CHECK_IN_NOT_ALLOWED') : undefined))
    const { user } = renderWithProviders(<WeekPanel />, { route: '/progress' })

    await user.click(await screen.findByRole('button', { name: 'Read, Tue 17 Nov, Missed' }))
    await user.click(screen.getByRole('button', { name: /^Minimum done/ }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent(
      'That period can no longer be changed',
    )
  })

  it('moves between weeks', async () => {
    const fetchMock = api()
    const { user } = renderWithProviders(<WeekPanel />, { route: '/progress' })

    expect(await screen.findByRole('region', { name: 'This week' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'This week' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Previous week' }))

    expect(await screen.findByRole('button', { name: 'This week' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Distribution' })).toBeInTheDocument()
    expect(requests(fetchMock).map((r) => r.url)).toContain('/api/stats/week?start=2026-11-09')
  })

  it('points to the habits page when there are none', async () => {
    api((r) => (r.url.startsWith('/api/stats/week') ? jsonResponse({ ...week, habits: [], distribution: { green: 0, yellow: 0, red: 0, grey: 0, total: 0 } }) : undefined))
    renderWithProviders(<WeekPanel />, { route: '/progress' })

    expect(await screen.findByRole('link', { name: 'Create your first habit' })).toHaveAttribute('href', '/habits')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd web && npx vitest run src/features/stats src/features/progress`
Expected: FAIL — `./DistributionDonut` and `./WeekPanel` cannot be resolved.

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

/** Returning the invalidation promise makes `mutateAsync` resolve after week, month and streaks have refetched. */
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

- [ ] **Step 4: Implement the donut and streak list**

`web/src/features/stats/DistributionDonut.tsx`:
```tsx
import type { Distribution } from '../../api/types'
import { card, cardTitle } from '../../lib/ui'

const SEGMENTS = [
  { key: 'green', label: 'Green', stroke: 'var(--color-cell-green)', dot: 'bg-cell-green' },
  { key: 'yellow', label: 'Yellow', stroke: 'var(--color-cell-yellow)', dot: 'bg-cell-yellow' },
  { key: 'red', label: 'Red', stroke: 'var(--color-cell-red)', dot: 'bg-cell-red' },
  { key: 'grey', label: 'Unmarked', stroke: 'var(--color-cell-grey)', dot: 'bg-cell-grey' },
] as const

/** r = 15.9155 gives a circumference of 100, so dash lengths are percentages. */
const RADIUS = 15.9155

export function DistributionDonut({ title, distribution }: { title: string; distribution: Distribution }) {
  const { total } = distribution
  const shares = SEGMENTS.map(({ key }) => (total === 0 ? 0 : (distribution[key] * 100) / total))
  const starts = shares.map((_, i) => shares.slice(0, i).reduce((sum, share) => sum + share, 0))

  return (
    <section aria-label={title} className={card}>
      <h2 className={cardTitle}>{title}</h2>
      <div className="flex items-center gap-6">
        <div className="relative h-28 w-28 flex-none">
          <svg viewBox="0 0 36 36" className="h-full w-full" aria-hidden="true">
            <circle cx="18" cy="18" r={RADIUS} fill="none" stroke="var(--color-surface)" strokeWidth="4" />
            {SEGMENTS.map(({ key, stroke }, i) =>
              shares[i] > 0 ? (
                <circle key={key} cx="18" cy="18" r={RADIUS} fill="none" stroke={stroke} strokeWidth="4"
                  strokeDasharray={`${shares[i]} ${100 - shares[i]}`} strokeDashoffset={25 - starts[i]} />
              ) : null,
            )}
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[20px] font-extrabold text-fg">{total === 0 ? '–' : `${Math.round(shares[0])}%`}</span>
            <span className="text-[10px] font-semibold tracking-wider text-muted uppercase">green</span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          {total === 0 && <p className="mb-2 text-sm text-muted">Nothing marked yet</p>}
          <ul className="flex flex-col gap-2">
            {SEGMENTS.map(({ key, label, dot }) => (
              <li key={key} aria-label={`${label} ${distribution[key]}`} className="flex items-center gap-2 text-sm">
                <span className={`h-2.5 w-2.5 flex-none rounded-full ${dot}`} aria-hidden="true" />
                <span className="flex-1 text-muted">{label}</span>
                <span className="font-semibold text-fg">{distribution[key]}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

export default DistributionDonut
```

`web/src/features/stats/StreakList.tsx`:
```tsx
import { Flame } from 'lucide-react'
import { card, cardTitle } from '../../lib/ui'
import { useStreaks } from './api'

/** Current and best streak per habit; streaks count GREEN/YELLOW periods and skip paused ones. */
export function StreakList() {
  const { data } = useStreaks()
  return (
    <section aria-label="Streaks" className={card}>
      <h2 className={cardTitle}>Streaks</h2>
      {data?.length === 0 && <p className="text-sm text-muted">No habits yet</p>}
      <ul className="divide-y divide-line">
        {data?.map((streak) => (
          <li key={streak.habitId} aria-label={streak.name} className="flex items-center gap-2 py-2.5 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium text-fg">{streak.name}</span>
            {streak.current > 0 && <Flame size={16} className="text-urgent" aria-hidden="true" />}
            <span className="text-muted">
              <b className="font-semibold text-fg">{streak.current}</b> · best {streak.best}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default StreakList
```

- [ ] **Step 5: Implement the period helpers, picker and grid**

`web/src/features/checkin/period.ts`:
```ts
import type { WeekCell, WeekHabit } from '../../api/types'
import { addDays, formatDay } from '../../lib/dates'

type HabitLike = Pick<WeekHabit, 'frequency'>
type CellLike = Pick<WeekCell, 'date'>

/** "Wed 18 Nov", or "week of Mon 16 Nov" for weekly habits. */
export function periodLabel(habit: HabitLike, cell: CellLike): string {
  return habit.frequency === 'WEEKLY' ? `week of ${formatDay(cell.date)}` : formatDay(cell.date)
}

/** A weekly cell covers its whole Mon–Sun week; other cells cover one day. */
export function coversToday(habit: HabitLike, cell: CellLike, today: string): boolean {
  return habit.frequency === 'WEEKLY' ? cell.date <= today && today <= addDays(cell.date, 6) : cell.date === today
}
```

`web/src/features/checkin/CellPicker.tsx`:
```tsx
import { useState } from 'react'
import { messageFor } from '../../api/errors'
import type { Color, WeekCell, WeekHabit } from '../../api/types'
import { cellClass, isColor, STATE_LABEL } from '../../lib/cells'
import { eyebrow, inputClass, primaryButton, secondaryButton } from '../../lib/ui'
import { useClearCheckIn, useSaveCheckIn } from '../stats/api'
import { periodLabel } from './period'

const CHOICES: { color: Color; hint(habit: WeekHabit): string }[] = [
  { color: 'GREEN', hint: (habit) => habit.targetText },
  { color: 'YELLOW', hint: (habit) => habit.minText },
  { color: 'RED', hint: () => "Didn't do it" },
]

interface CellPickerProps {
  habit: WeekHabit
  cell: WeekCell
  onClose(): void
}

/** Bottom sheet on phones, centred dialog on wider screens. Saves only on "Save"; Clear removes the check-in. */
export function CellPicker({ habit, cell, onClose }: CellPickerProps) {
  const saveCheckIn = useSaveCheckIn()
  const clearCheckIn = useClearCheckIn()
  const marked = isColor(cell.state)
  const [color, setColor] = useState<Color | null>(isColor(cell.state) ? cell.state : null)
  const [note, setNote] = useState(cell.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const busy = saveCheckIn.isPending || clearCheckIn.isPending
  const key = { habitId: habit.id, periodStart: cell.periodStart ?? cell.date }

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
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}>
      <div role="dialog" aria-modal="true" aria-label={`${habit.name}, ${periodLabel(habit, cell)}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
        }}
        className="w-full rounded-t-[28px] border border-line bg-card px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:max-w-md md:rounded-[28px] md:pt-6">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline md:hidden" aria-hidden="true" />
        <p className={eyebrow}>{periodLabel(habit, cell)}</p>
        <h2 className="mt-0.5 mb-4 text-[22px] font-extrabold text-fg">{habit.name}</h2>
        <div className="flex flex-col gap-2">
          {CHOICES.map((choice) => (
            <button key={choice.color} type="button" aria-pressed={color === choice.color}
              onClick={() => setColor(choice.color)}
              className={`flex w-full items-center gap-3 rounded-2xl border bg-surface p-3.5 text-left ${
                color === choice.color ? 'border-accent' : 'border-line'
              }`}>
              <span className={`h-6 w-6 flex-none rounded-lg ${cellClass(choice.color)}`} aria-hidden="true" />
              <span className="text-[15px] font-semibold text-fg">
                {STATE_LABEL[choice.color]}
                <small className="block text-[13px] font-normal text-muted">{choice.hint(habit)}</small>
              </span>
            </button>
          ))}
        </div>
        <label htmlFor="check-in-note" className="mt-4 mb-1.5 block text-[13px] font-medium text-muted">
          Note (optional)
        </label>
        <textarea id="check-in-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
          className={inputClass} />
        {error && <p role="alert" className="mt-2 text-sm text-cell-red">{error}</p>}
        <div className="mt-5 flex items-center gap-2">
          {marked && (
            <button type="button" disabled={busy}
              className="rounded-[14px] border border-line bg-surface px-4 py-3 text-[15px] font-medium text-cell-red disabled:opacity-50"
              onClick={() => void run(() => clearCheckIn.mutateAsync(key))}>Clear</button>
          )}
          <button type="button" onClick={onClose} className={`${secondaryButton} ml-auto`}>Cancel</button>
          <button type="button" disabled={!color || busy} className={primaryButton}
            onClick={() => {
              if (color) void run(() => saveCheckIn.mutateAsync({ ...key, color, note: note.trim() || null }))
            }}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default CellPicker
```

`web/src/features/progress/WeekGrid.tsx`:
```tsx
import type { WeekCell, WeekHabit } from '../../api/types'
import { cellClass, STATE_LABEL } from '../../lib/cells'
import { addDays, dayOfMonth, WEEKDAYS } from '../../lib/dates'
import { coversToday, periodLabel } from '../checkin/period'

function subtitle(habit: WeekHabit): string | null {
  if (habit.frequency === 'WEEKLY') return 'weekly'
  if (habit.frequency === 'EVERY_N_DAYS') return `every ${habit.intervalDays} days`
  return null
}

interface WeekGridProps {
  start: string
  today: string
  habits: WeekHabit[]
  onPick(habit: WeekHabit, cell: WeekCell): void
}

/** Habits × Mon–Sun. Weekly habits have one cell spanning all 7 columns. */
export function WeekGrid({ start, today, habits, onPick }: WeekGridProps) {
  return (
    <table className="w-full table-fixed border-separate border-spacing-[5px]">
      <thead>
        <tr>
          <th className="w-20 md:w-32"><span className="sr-only">Habit</span></th>
          {WEEKDAYS.map((weekday, i) => {
            const date = addDays(start, i)
            return (
              <th key={weekday} scope="col" className="text-center text-[11px] font-medium text-muted">
                {weekday}
                <span className={`mx-auto mt-1 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold ${
                  date === today ? 'bg-accent text-bg' : 'text-fg'
                }`}>
                  {dayOfMonth(date)}
                </span>
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {habits.map((habit) => (
          <tr key={habit.id}>
            <th scope="row" className="pr-1 text-left align-middle">
              <span className="block truncate text-[13px] font-semibold text-fg md:text-sm">{habit.name}</span>
              {subtitle(habit) && <span className="block truncate text-[11px] font-normal text-dim">{subtitle(habit)}</span>}
            </th>
            {habit.cells.map((cell) => {
              const isToday = coversToday(habit, cell, today)
              const weekly = habit.frequency === 'WEEKLY'
              return (
                <td key={cell.date} colSpan={weekly ? 7 : undefined}>
                  <button
                    type="button"
                    aria-label={`${habit.name}, ${periodLabel(habit, cell)}, ${STATE_LABEL[cell.state]}`}
                    aria-current={isToday ? 'date' : undefined}
                    disabled={!cell.editable}
                    onClick={() => onPick(habit, cell)}
                    className={`block w-full rounded-cell ${weekly ? 'h-[34px]' : 'aspect-square'} ${cellClass(cell.state)} ${
                      isToday ? 'ring-2 ring-accent ring-offset-2 ring-offset-card' : ''
                    } ${cell.editable ? 'cursor-pointer transition-transform active:scale-95' : cell.state === 'NOT_DUE' ? '' : 'opacity-50'}`}
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

- [ ] **Step 6: Implement the panel, page and route**

`web/src/features/progress/WeekPanel.tsx`:
```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { WeekCell, WeekHabit } from '../../api/types'
import { addDays, formatWeekRange } from '../../lib/dates'
import { card, pillButton } from '../../lib/ui'
import { CellPicker } from '../checkin/CellPicker'
import { useWeek } from '../stats/api'
import { DistributionDonut } from '../stats/DistributionDonut'
import { StreakList } from '../stats/StreakList'
import { WeekGrid } from './WeekGrid'

const iconButton = 'flex h-9 w-9 flex-none items-center justify-center rounded-full bg-card text-fg'

export function WeekPanel() {
  const [searchParams, setSearchParams] = useSearchParams()
  const start = searchParams.get('start') ?? undefined
  const { data, isPending, isError } = useWeek(start)
  const [picked, setPicked] = useState<{ habit: WeekHabit; cell: WeekCell } | null>(null)

  if (isPending) return <p className="text-muted">Loading…</p>
  if (isError) return <p role="alert" className="text-cell-red">Couldn't load this week.</p>

  const goTo = (weekStart: string) => setSearchParams({ start: weekStart })

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button type="button" aria-label="Previous week" className={iconButton}
          onClick={() => goTo(addDays(data.start, -7))}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <h2 className="min-w-0 flex-1 text-center text-[17px] font-semibold text-fg md:flex-none md:px-2">
          {formatWeekRange(data.start)}
        </h2>
        <button type="button" aria-label="Next week" className={iconButton}
          onClick={() => goTo(addDays(data.start, 7))}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        {start && <button type="button" className={pillButton} onClick={() => setSearchParams({})}>This week</button>}
      </div>
      {data.habits.length === 0 ? (
        <p className={`${card} text-muted`}>
          No habits yet. <Link to="/habits" className="font-semibold text-accent">Create your first habit</Link>
        </p>
      ) : (
        <div className={`${card} px-2 md:px-4`}>
          <WeekGrid start={data.start} today={data.today} habits={data.habits}
            onPick={(habit, cell) => setPicked({ habit, cell })} />
        </div>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <DistributionDonut title={start ? 'Distribution' : 'This week'} distribution={data.distribution} />
        <StreakList />
      </div>
      {picked && <CellPicker habit={picked.habit} cell={picked.cell} onClose={() => setPicked(null)} />}
    </div>
  )
}

export default WeekPanel
```

`web/src/features/progress/ProgressPage.tsx` (Task 6 adds the Week | Month switch):
```tsx
import { pageTitle } from '../../lib/ui'
import { WeekPanel } from './WeekPanel'

export function ProgressPage() {
  return (
    <section className="max-w-5xl">
      <h1 className={`${pageTitle} mb-5`}>Progress</h1>
      <WeekPanel />
    </section>
  )
}

export default ProgressPage
```

`web/src/app/router.tsx`: import `ProgressPage` and add, inside the `Shell` route:
```tsx
import { ProgressPage } from '../features/progress/ProgressPage'
// …
        <Route path="/progress" element={<ProgressPage />} />
```

- [ ] **Step 7: Run tests, lint and build**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: all PASS, no lint errors.

- [ ] **Step 8: Commit**

```bash
git add web
git commit -m "feat(web): add progress week view with picker, distribution donut and streaks" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Today page (one-tap marking, progress ring, countdown)

Matches the "Today" frames of the mockups (phone and desktop). The home route `/` becomes Today.

**Files:**
- Create: `web/src/lib/{timeLeft,useNow}.ts`, `web/src/features/today/{todayItems.ts,ProgressRing.tsx,HabitCard.tsx,TodayPage.tsx}`
- Modify: `web/src/app/router.tsx` (`/` → `TodayPage`; delete `Welcome`)
- Test: `web/src/lib/timeLeft.test.ts`, `web/src/lib/useNow.test.ts`, `web/src/features/today/TodayPage.test.tsx`

**Interfaces:**
- Consumes: `useWeek`, `useStreaks`, `useSaveCheckIn`, `CellPicker`, `WeekGrid`, `StreakList` (Task 4); `WeekView`, `WeekHabit`, `WeekCell`, `Color`, `Frequency`, `Streak` (Task 1); `cellClass`, `isColor` (Task 1); `formatLongDay` (Task 1); `card`, `cardTitle`, `eyebrow`, `pageTitle` (Task 2); `messageFor` (Task 1).
- Produces:
  - `formatTimeLeft(closesAt: string, now: Date, frequency: Frequency): string | null` — `null` once `closesAt ≤ now`; `< 1h` → `"40m left"`; `< 3h` → `"2h 40m left"`; otherwise DAILY `"12h left today"`, EVERY_N_DAYS `"1d 12h left in this period"`, WEEKLY `"4d 12h left this week"` (days omitted when 0).
  - `isUrgent(closesAt: string, now: Date): boolean` — true when 0 < time left < 3h.
  - `useNow(intervalMs = 60_000): Date`
  - `todayItems(week: WeekView): TodayItem[]` (`TodayItem = { habit: WeekHabit; cell: WeekCell }`)
  - `TodayPage` at `/`: each habit is an `article` named after the habit with buttons `Target` / `Minimum` / `Missed` (`aria-pressed` on the selected one), a countdown chip carrying `data-tone="normal" | "urgent" | "done"`, and the hero ring `role="img"` named `"N of M done"`. The e2e test (Task 8) relies on these.

- [ ] **Step 1: Write the failing tests**

`web/src/lib/timeLeft.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { formatTimeLeft, isUrgent } from './timeLeft'

const now = new Date('2026-11-18T06:30:00Z')

describe('formatTimeLeft', () => {
  it('counts hours for daily habits', () => {
    expect(formatTimeLeft('2026-11-18T18:30:00Z', now, 'DAILY')).toBe('12h left today')
    expect(formatTimeLeft('2026-11-19T06:30:00Z', now, 'DAILY')).toBe('24h left today')
  })

  it('counts days and hours for longer periods', () => {
    expect(formatTimeLeft('2026-11-19T18:30:00Z', now, 'EVERY_N_DAYS')).toBe('1d 12h left in this period')
    expect(formatTimeLeft('2026-11-19T02:30:00Z', now, 'EVERY_N_DAYS')).toBe('20h left in this period')
    expect(formatTimeLeft('2026-11-22T18:30:00Z', now, 'WEEKLY')).toBe('4d 12h left this week')
  })

  it('switches to hours and minutes in the last three hours', () => {
    expect(formatTimeLeft('2026-11-18T09:10:00Z', now, 'WEEKLY')).toBe('2h 40m left')
    expect(formatTimeLeft('2026-11-18T09:30:00Z', now, 'DAILY')).toBe('3h left today')
  })

  it('shows minutes in the last hour', () => {
    expect(formatTimeLeft('2026-11-18T07:10:00Z', now, 'DAILY')).toBe('40m left')
    expect(formatTimeLeft('2026-11-18T06:30:30Z', now, 'DAILY')).toBe('1m left')
  })

  it('returns null once the period has closed', () => {
    expect(formatTimeLeft('2026-11-18T06:30:00Z', now, 'DAILY')).toBeNull()
    expect(formatTimeLeft('2026-11-17T18:30:00Z', now, 'DAILY')).toBeNull()
  })
})

describe('isUrgent', () => {
  it('is true only with less than three hours left', () => {
    expect(isUrgent('2026-11-18T09:10:00Z', now)).toBe(true)
    expect(isUrgent('2026-11-18T09:30:00Z', now)).toBe(false)
    expect(isUrgent('2026-11-18T18:30:00Z', now)).toBe(false)
    expect(isUrgent('2026-11-18T06:00:00Z', now)).toBe(false)
  })
})
```

`web/src/lib/useNow.test.ts`:
```ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNow } from './useNow'

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-18T06:30:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refreshes every minute', () => {
    const { result } = renderHook(() => useNow())
    expect(result.current.toISOString()).toBe('2026-11-18T06:30:00.000Z')

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(result.current.toISOString()).toBe('2026-11-18T06:31:00.000Z')
  })
})
```

`web/src/features/today/TodayPage.test.tsx`:
```tsx
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Streak, WeekCell, WeekView } from '../../api/types'
import { jsonResponse, problemResponse, requests, stubApi, type ApiRequest } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { TodayPage } from './TodayPage'

const days = ['16', '17', '18', '19', '20', '21', '22'].map((d) => `2026-11-${d}`)

/** Daily cells in Asia/Kolkata: each day closes at 18:30Z (midnight IST). */
function daily(states: WeekCell['state'][], notes: (string | null)[] = []): WeekCell[] {
  return days.map((date, i) => ({
    date,
    periodStart: states[i] === 'NOT_DUE' ? null : date,
    state: states[i],
    editable: date <= '2026-11-18' && states[i] !== 'PAUSED' && states[i] !== 'NOT_DUE',
    note: notes[i] ?? null,
    closesAt: states[i] === 'NOT_DUE' ? null : `${date}T18:30:00Z`,
  }))
}

const STRETCH_WEEK: WeekCell['state'][] = ['GREEN', 'RED', 'PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING']

const week: WeekView = {
  start: '2026-11-16',
  today: '2026-11-18',
  distribution: { green: 2, yellow: 0, red: 1, grey: 0, total: 3 },
  habits: [
    { id: 1, name: 'Read', minText: '1 page', targetText: '20 pages', frequency: 'DAILY', intervalDays: null,
      cells: daily(['GREEN', 'RED', 'GREEN', 'PENDING', 'PENDING', 'PENDING', 'PENDING'], [null, null, 'ch 3']) },
    { id: 2, name: 'Run', minText: '1 km', targetText: '5 km', frequency: 'EVERY_N_DAYS', intervalDays: 3,
      cells: daily(['NOT_DUE', 'NOT_DUE', 'PENDING', 'NOT_DUE', 'NOT_DUE', 'PENDING', 'NOT_DUE']).map((cell) =>
        cell.date === '2026-11-18' ? { ...cell, closesAt: '2026-11-20T18:30:00Z' }
          : cell.date === '2026-11-21' ? { ...cell, closesAt: '2026-11-23T18:30:00Z' } : cell) },
    { id: 3, name: 'Piano', minText: '5 min', targetText: '30 min', frequency: 'WEEKLY', intervalDays: null,
      cells: [{ date: '2026-11-16', periodStart: '2026-11-16', state: 'PENDING', editable: true, note: null,
        closesAt: '2026-11-22T18:30:00Z' }] },
    { id: 4, name: 'Meditate', minText: '1 min', targetText: '10 min', frequency: 'DAILY', intervalDays: null,
      cells: daily(Array<WeekCell['state']>(7).fill('PAUSED')) },
    { id: 5, name: 'Stretch', minText: '1 pose', targetText: '15 min', frequency: 'DAILY', intervalDays: null,
      cells: daily(STRETCH_WEEK) },
  ],
}

const streaks: Streak[] = [
  { habitId: 1, name: 'Read', current: 12, best: 20 },
  { habitId: 2, name: 'Run', current: 0, best: 4 },
  { habitId: 3, name: 'Piano', current: 2, best: 2 },
  { habitId: 5, name: 'Stretch', current: 1, best: 3 },
]

function api(overrides: (r: ApiRequest) => Response | undefined = () => undefined, data: WeekView = week) {
  return stubApi((r) => {
    const custom = overrides(r)
    if (custom) return custom
    if (r.url.startsWith('/api/stats/week')) return jsonResponse(data)
    if (r.url === '/api/stats/streaks') return jsonResponse(streaks)
    return undefined
  })
}

function chip(article: HTMLElement): HTMLElement | null {
  return article.querySelector('[data-tone]')
}

describe('TodayPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-18T06:30:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows the date, today's progress and one card per habit due today", async () => {
    api()
    renderWithProviders(<TodayPage />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
    expect(screen.getByText('Wednesday, 18 Nov')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '1 of 4 done' })).toBeInTheDocument()
    expect(screen.getByText('3 habits left today. Even the minimum keeps it off red.')).toBeInTheDocument()
    const names = screen.getAllByRole('article').map((article) => within(article).getByRole('heading').textContent)
    expect(names).toEqual(['Read', 'Run', 'Piano', 'Stretch'])

    const read = screen.getByRole('article', { name: 'Read' })
    expect(within(read).getByRole('button', { name: 'Target' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(read).getByRole('button', { name: 'Minimum' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(read).getByRole('button', { name: 'Missed' })).toHaveAttribute('aria-pressed', 'false')
    expect(read).toHaveTextContent('Min 1 page · Target 20 pages')
    await waitFor(() => expect(read).toHaveTextContent('Current streak 12'))
    expect(chip(read)).toHaveTextContent('12h left today')
    expect(chip(read)).toHaveAttribute('data-tone', 'done')

    const run = screen.getByRole('article', { name: 'Run' })
    expect(run).toHaveTextContent('Every 3 days · Min 1 km · Target 5 km')
    expect(chip(run)).toHaveTextContent('2d 12h left in this period')
    expect(chip(run)).toHaveAttribute('data-tone', 'normal')

    const piano = screen.getByRole('article', { name: 'Piano' })
    expect(piano).toHaveTextContent('This week · Min 5 min · Target 30 min')
    expect(chip(piano)).toHaveTextContent('4d 12h left this week')

    expect(chip(screen.getByRole('article', { name: 'Stretch' }))).toHaveTextContent('12h left today')
  })

  it('turns the countdown orange in the last three hours', async () => {
    vi.setSystemTime(new Date('2026-11-18T15:50:00Z'))
    api()
    renderWithProviders(<TodayPage />)

    const stretch = await screen.findByRole('article', { name: 'Stretch' })
    expect(chip(stretch)).toHaveTextContent('2h 40m left')
    expect(chip(stretch)).toHaveAttribute('data-tone', 'urgent')
    expect(chip(screen.getByRole('article', { name: 'Read' }))).toHaveAttribute('data-tone', 'done')
  })

  it('hides the countdown once the period has closed', async () => {
    vi.setSystemTime(new Date('2026-11-18T18:31:00Z'))
    api()
    renderWithProviders(<TodayPage />)

    expect(chip(await screen.findByRole('article', { name: 'Stretch' }))).toBeNull()
  })

  it('marks with one tap, keeping the existing note', async () => {
    const fetchMock = api((r) => (r.method === 'PUT' ? jsonResponse({ periodStart: '2026-11-18', color: 'RED', note: 'ch 3' }) : undefined))
    const { user } = renderWithProviders(<TodayPage />)

    const read = await screen.findByRole('article', { name: 'Read' })
    await user.click(within(read).getByRole('button', { name: 'Missed' }))

    await waitFor(() =>
      expect(requests(fetchMock).find((r) => r.method === 'PUT')).toEqual({
        method: 'PUT',
        url: '/api/habits/1/check-ins/2026-11-18',
        body: { color: 'RED', note: 'ch 3' },
      }),
    )
    await waitFor(() =>
      expect(requests(fetchMock).filter((r) => r.url.startsWith('/api/stats/week')).length).toBeGreaterThan(1),
    )
  })

  it("marks a weekly habit's period", async () => {
    const fetchMock = api((r) => (r.method === 'PUT' ? jsonResponse({ periodStart: '2026-11-16', color: 'YELLOW', note: null }) : undefined))
    const { user } = renderWithProviders(<TodayPage />)

    const piano = await screen.findByRole('article', { name: 'Piano' })
    await user.click(within(piano).getByRole('button', { name: 'Minimum' }))

    await waitFor(() =>
      expect(requests(fetchMock).find((r) => r.method === 'PUT')).toEqual({
        method: 'PUT',
        url: '/api/habits/3/check-ins/2026-11-16',
        body: { color: 'YELLOW', note: null },
      }),
    )
  })

  it('does nothing when the selected button is tapped again', async () => {
    const fetchMock = api()
    const { user } = renderWithProviders(<TodayPage />)

    const read = await screen.findByRole('article', { name: 'Read' })
    await user.click(within(read).getByRole('button', { name: 'Target' }))

    expect(requests(fetchMock).filter((r) => r.method === 'PUT')).toEqual([])
  })

  it('opens the picker from the habit name to add a note', async () => {
    api()
    const { user } = renderWithProviders(<TodayPage />)

    const read = await screen.findByRole('article', { name: 'Read' })
    await user.click(within(read).getByRole('button', { name: 'Read' }))

    const dialog = screen.getByRole('dialog', { name: 'Read, Wed 18 Nov' })
    expect(within(dialog).getByRole('button', { name: /^Target hit/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByLabelText('Note (optional)')).toHaveValue('ch 3')
  })

  it('shows save errors on the card', async () => {
    api((r) => (r.method === 'PUT' ? problemResponse(422, 'CHECK_IN_NOT_ALLOWED') : undefined))
    const { user } = renderWithProviders(<TodayPage />)

    const stretch = await screen.findByRole('article', { name: 'Stretch' })
    await user.click(within(stretch).getByRole('button', { name: 'Minimum' }))

    expect(await within(stretch).findByRole('alert')).toHaveTextContent('That period can no longer be changed')
  })

  it('celebrates when everything is marked', async () => {
    const allDone: WeekView = {
      ...week,
      habits: week.habits.filter((habit) => habit.name === 'Read'),
    }
    api(undefined, allDone)
    renderWithProviders(<TodayPage />)

    expect(await screen.findByRole('img', { name: '1 of 1 done' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'All done' })).toBeInTheDocument()
  })

  it('points to the habits page when there are none', async () => {
    api(undefined, { ...week, habits: [], distribution: { green: 0, yellow: 0, red: 0, grey: 0, total: 0 } })
    renderWithProviders(<TodayPage />)

    expect(await screen.findByRole('link', { name: 'Create your first habit' })).toHaveAttribute('href', '/habits')
  })
})
```

> Only `Date` is faked (`toFake: ['Date']`), so React Query and user-event keep their real timers.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd web && npx vitest run src/lib src/features/today`
Expected: FAIL — `./timeLeft`, `./useNow` and `./TodayPage` cannot be resolved.

- [ ] **Step 3: Implement the countdown helpers**

`web/src/lib/timeLeft.ts`:
```ts
import type { Frequency } from '../api/types'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const URGENT = 3 * HOUR

const SUFFIX: Record<Frequency, string> = {
  DAILY: 'left today',
  EVERY_N_DAYS: 'left in this period',
  WEEKLY: 'left this week',
}

/**
 * Countdown text until the period closes (`closesAt`, an ISO instant from the API), or null once it has passed.
 * This is a nudge, not a lock: closed periods stay editable for 7 days (the API decides).
 */
export function formatTimeLeft(closesAt: string, now: Date, frequency: Frequency): string | null {
  const ms = Date.parse(closesAt) - now.getTime()
  if (ms <= 0) return null
  if (ms < HOUR) return `${Math.max(1, Math.floor(ms / MINUTE))}m left`
  if (ms < URGENT) return `${Math.floor(ms / HOUR)}h ${Math.floor((ms % HOUR) / MINUTE)}m left`
  const days = Math.floor(ms / DAY)
  const text = frequency === 'DAILY' || days === 0
    ? `${Math.floor(ms / HOUR)}h`
    : `${days}d ${Math.floor((ms % DAY) / HOUR)}h`
  return `${text} ${SUFFIX[frequency]}`
}

export function isUrgent(closesAt: string, now: Date): boolean {
  const ms = Date.parse(closesAt) - now.getTime()
  return ms > 0 && ms < URGENT
}
```

`web/src/lib/useNow.ts`:
```ts
import { useEffect, useState } from 'react'

/** The current time, refreshed every `intervalMs` (default one minute) so countdowns tick. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
```

- [ ] **Step 4: Implement the today items, ring and habit card**

`web/src/features/today/todayItems.ts`:
```ts
import type { WeekCell, WeekHabit, WeekView } from '../../api/types'

export interface TodayItem {
  habit: WeekHabit
  cell: WeekCell
}

/**
 * The period each habit can be marked for today: a weekly habit's single cell, otherwise the cell dated today.
 * Paused, not-due and non-editable cells are left out (every-N-days habits show on their due day only).
 */
export function todayItems(week: WeekView): TodayItem[] {
  return week.habits.flatMap((habit) => {
    const cell = habit.frequency === 'WEEKLY' ? habit.cells[0] : habit.cells.find((c) => c.date === week.today)
    const markable = cell !== undefined && cell.editable && cell.state !== 'PAUSED' && cell.state !== 'NOT_DUE'
    return markable ? [{ habit, cell }] : []
  })
}
```

`web/src/features/today/ProgressRing.tsx`:
```tsx
/** "N/M DONE" ring; r = 15.9155 makes the circumference 100. */
export function ProgressRing({ done, total }: { done: number; total: number }) {
  const share = total === 0 ? 0 : (done * 100) / total
  return (
    <div role="img" aria-label={`${done} of ${total} done`} className="relative h-24 w-24 flex-none">
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--color-surface)" strokeWidth="3.2" />
        {share > 0 && (
          <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--color-cell-green)" strokeWidth="3.2"
            strokeLinecap="round" strokeDasharray={`${share} 100`}
            className="transition-[stroke-dasharray] duration-500" />
        )}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className="text-[22px] leading-none font-extrabold text-fg">{done}/{total}</span>
        <span className="mt-1 text-[10px] font-semibold tracking-wider text-muted">DONE</span>
      </span>
    </div>
  )
}

export default ProgressRing
```

`web/src/features/today/HabitCard.tsx`:
```tsx
import { Check, Clock, Flame } from 'lucide-react'
import { useId, useState } from 'react'
import { messageFor } from '../../api/errors'
import type { Color, WeekCell, WeekHabit } from '../../api/types'
import { cellClass, isColor } from '../../lib/cells'
import { formatTimeLeft, isUrgent } from '../../lib/timeLeft'
import { card } from '../../lib/ui'
import { useSaveCheckIn } from '../stats/api'

const BUTTONS: { color: Color; label: string; selected: string }[] = [
  { color: 'GREEN', label: 'Target', selected: 'border-cell-green bg-cell-green text-bg' },
  { color: 'YELLOW', label: 'Minimum', selected: 'border-cell-yellow bg-cell-yellow text-bg' },
  { color: 'RED', label: 'Missed', selected: 'border-cell-red bg-cell-red text-white' },
]

type Tone = 'normal' | 'urgent' | 'done'

const TONE_CLASS: Record<Tone, string> = {
  normal: 'bg-surface text-muted',
  urgent: 'bg-urgent/15 text-urgent',
  done: 'bg-cell-green/15 text-cell-green',
}

function meta(habit: WeekHabit): string {
  const texts = `Min ${habit.minText} · Target ${habit.targetText}`
  if (habit.frequency === 'EVERY_N_DAYS') return `Every ${habit.intervalDays} days · ${texts}`
  if (habit.frequency === 'WEEKLY') return `This week · ${texts}`
  return texts
}

interface HabitCardProps {
  habit: WeekHabit
  cell: WeekCell
  /** Current streak, once the streaks query has loaded. */
  streak: number | undefined
  now: Date
  onOpen(): void
}

/** One habit on Today: tap Target / Minimum / Missed to save at once (keeping any note); tap the name for the picker. */
export function HabitCard({ habit, cell, streak, now, onOpen }: HabitCardProps) {
  const saveCheckIn = useSaveCheckIn()
  const titleId = useId()
  const [error, setError] = useState<string | null>(null)
  const marked = isColor(cell.state)
  const timeLeft = cell.closesAt ? formatTimeLeft(cell.closesAt, now, habit.frequency) : null
  const tone: Tone = marked ? 'done' : cell.closesAt && isUrgent(cell.closesAt, now) ? 'urgent' : 'normal'

  async function mark(color: Color): Promise<void> {
    if (cell.state === color) return
    setError(null)
    try {
      await saveCheckIn.mutateAsync({ habitId: habit.id, periodStart: cell.periodStart ?? cell.date, color, note: cell.note })
    } catch (err) {
      setError(messageFor(err))
    }
  }

  return (
    <article aria-labelledby={titleId} className={card}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-[18px] font-bold text-fg">
            <button type="button" aria-haspopup="dialog" onClick={onOpen} className="text-left hover:underline">
              {habit.name}
            </button>
          </h2>
          <p className="mt-0.5 truncate text-[13px] text-muted">{meta(habit)}</p>
        </div>
        {streak !== undefined && (
          <span className="flex flex-none items-center gap-1 text-[15px] font-bold text-fg">
            <Flame size={18} className={streak > 0 ? 'text-urgent' : 'text-dim'} aria-hidden="true" />
            <span className="sr-only">Current streak </span>
            {streak}
          </span>
        )}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {BUTTONS.map(({ color, label, selected }) => {
          const pressed = cell.state === color
          return (
            <button key={color} type="button" aria-pressed={pressed} disabled={saveCheckIn.isPending}
              onClick={() => void mark(color)}
              className={`flex items-center justify-center gap-1.5 rounded-[14px] border py-3 text-[14px] font-semibold transition-transform active:scale-[0.97] disabled:opacity-60 ${
                pressed ? selected : 'border-line bg-surface text-fg'
              }`}>
              {pressed && <Check size={16} strokeWidth={3} aria-hidden="true" />}
              {label}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        {timeLeft ? (
          <span data-tone={tone}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${TONE_CLASS[tone]}`}>
            <Clock size={13} aria-hidden="true" />
            {timeLeft}
          </span>
        ) : (
          <span />
        )}
        {habit.frequency === 'DAILY' && (
          <span className="flex gap-1 md:hidden" aria-hidden="true">
            {habit.cells.map((c) => (
              <span key={c.date} className={`h-1.5 w-4 rounded-full ${
                c.state === 'PENDING' || c.state === 'NOT_DUE' ? 'bg-surface' : cellClass(c.state)
              }`} />
            ))}
          </span>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-cell-red">{error}</p>}
    </article>
  )
}

export default HabitCard
```

- [ ] **Step 5: Implement the page and route**

`web/src/features/today/TodayPage.tsx`:
```tsx
import { useState } from 'react'
import { Link } from 'react-router'
import { isColor } from '../../lib/cells'
import { formatLongDay } from '../../lib/dates'
import { useNow } from '../../lib/useNow'
import { card, cardTitle, eyebrow, pageTitle } from '../../lib/ui'
import { CellPicker } from '../checkin/CellPicker'
import { WeekGrid } from '../progress/WeekGrid'
import { useStreaks, useWeek } from '../stats/api'
import { StreakList } from '../stats/StreakList'
import { HabitCard } from './HabitCard'
import { ProgressRing } from './ProgressRing'
import { todayItems, type TodayItem } from './todayItems'

function encouragement(total: number, left: number): [string, string] {
  if (total === 0) return ['Nothing due today', 'Enjoy the break.']
  if (left === 0) return ['All done', 'Every habit is marked for today. Nice work.']
  return ['Keep the chain green', `${left} ${left === 1 ? 'habit' : 'habits'} left today. Even the minimum keeps it off red.`]
}

/** Home: today's habits from the current week view, plus (desktop) the week grid and streaks. */
export function TodayPage() {
  const week = useWeek()
  const streaks = useStreaks()
  const now = useNow()
  const [picked, setPicked] = useState<TodayItem | null>(null)

  if (week.isPending) return <p className="text-muted">Loading…</p>
  if (week.isError) return <p role="alert" className="text-cell-red">Couldn't load today.</p>

  const data = week.data
  const items = todayItems(data)
  const done = items.filter(({ cell }) => isColor(cell.state)).length
  const [headline, message] = encouragement(items.length, items.length - done)
  const streakOf = (habitId: number) => streaks.data?.find((streak) => streak.habitId === habitId)?.current

  return (
    <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-8">
      <div>
        <p className={eyebrow}>{formatLongDay(data.today)}</p>
        <h1 className={`${pageTitle} mb-5`}>Today</h1>
        {data.habits.length === 0 ? (
          <p className={`${card} text-muted`}>
            No habits yet. <Link to="/habits" className="font-semibold text-accent">Create your first habit</Link>
          </p>
        ) : (
          <>
            <section aria-label="Today's progress" className={`${card} mb-4 flex items-center gap-5`}>
              <ProgressRing done={done} total={items.length} />
              <div>
                <h2 className="text-[20px] font-bold text-fg">{headline}</h2>
                <p className="mt-1 text-[14px] leading-snug text-muted">{message}</p>
              </div>
            </section>
            <div className="grid gap-3 xl:grid-cols-2">
              {items.map((item) => (
                <HabitCard key={item.habit.id} habit={item.habit} cell={item.cell} streak={streakOf(item.habit.id)}
                  now={now} onOpen={() => setPicked(item)} />
              ))}
            </div>
          </>
        )}
      </div>
      <aside aria-label="This week" className="hidden lg:flex lg:flex-col lg:gap-4">
        {data.habits.length > 0 && (
          <div className={`${card} px-3`}>
            <h2 className={`${cardTitle} px-2`}>This week</h2>
            <WeekGrid start={data.start} today={data.today} habits={data.habits}
              onPick={(habit, cell) => setPicked({ habit, cell })} />
          </div>
        )}
        <StreakList />
      </aside>
      {picked && <CellPicker habit={picked.habit} cell={picked.cell} onClose={() => setPicked(null)} />}
    </div>
  )
}

export default TodayPage
```

`web/src/app/router.tsx`: delete the `Welcome` component, import `TodayPage`, and change the index route:
```tsx
import { TodayPage } from '../features/today/TodayPage'
// …
        <Route path="/" element={<TodayPage />} />
```

`web/src/app/router.test.tsx`: the "shows the shell to signed-in users" and "keeps signed-in users away from the login page" tests now render Today, whose `/api/stats/*` requests 404 in those stubs. That's fine (the page shows "Couldn't load today." and the assertions only check the shell), so leave them unchanged.

- [ ] **Step 6: Run tests, lint and build**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: all PASS.

> jsdom ignores the `hidden lg:flex` breakpoint classes, so the desktop aside (week grid + streaks) is in the DOM during tests; the tests scope their queries to `article`s for that reason.

- [ ] **Step 7: Commit**

```bash
git add web
git commit -m "feat(web): add Today page with one-tap marking and countdown" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: Progress — month view and the Week | Month switch

Matches the "Progress · Month" frames of the mockups: a daily-score calendar heatmap with a red → green legend, the distribution donut, and a mini heatmap per habit.

**Files:**
- Create: `web/src/features/progress/{CalendarGrid,MonthPanel}.tsx`
- Modify: `web/src/features/progress/ProgressPage.tsx` (segmented control, `?view=month`)
- Test: `web/src/features/progress/MonthPanel.test.tsx`, `web/src/features/progress/ProgressPage.test.tsx`

**Interfaces:**
- Consumes: `useMonth`, `useWeek` (via `WeekPanel`), `DistributionDonut`, `WeekPanel` (Task 4); `MonthView`, `MonthHabit`, `WeekView` (Task 1); `addMonths`, `formatDay`, `formatMonth`, `dayOfMonth`, `weekdayIndex`, `WEEKDAYS`, `cellClass`, `STATE_LABEL` (Task 1); `card`, `cardTitle`, `pageTitle`, `pillButton` (Task 2).
- Produces:
  - `scoreClass(score: number | null): string` — `< 0.4` `bg-score-0`, `< 0.8` `bg-score-1`, `< 1.2` `bg-score-2`, `< 1.6` `bg-score-3`, else `bg-score-4`; `null` → `bg-surface text-dim`.
  - `CalendarGrid({ days, showNumbers?, compact? })`, where `days: { date: string; className: string; label: string }[]` (one month, in order); each day is `role="img"` named by `label`.
  - `MonthPanel` (reads/writes `?view=month&month=YYYY-MM`); per-habit sections are `region`s named after the habit with day labels `"<habit>, <Sun 1 Nov>, <state label>"`.
  - `ProgressPage` with a `group` "View" holding `Week` / `Month` buttons (`aria-pressed`); Week clears the query, Month sets `?view=month`.

- [ ] **Step 1: Write the failing tests**

`web/src/features/progress/MonthPanel.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CellState, MonthView } from '../../api/types'
import { jsonResponse, requests, stubApi } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { MonthPanel } from './MonthPanel'

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

function api() {
  return stubApi(({ url }) => (url.startsWith('/api/stats/month') ? jsonResponse(month) : undefined))
}

describe('MonthPanel', () => {
  it('colors the overview on a red → green scale, Monday first', async () => {
    api()
    renderWithProviders(<MonthPanel />, { route: '/progress?view=month' })

    expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument()
    const overview = screen.getByRole('region', { name: 'Daily score' })
    expect(within(overview).getByRole('img', { name: 'Sun 1 Nov: score 2.0' })).toHaveClass('bg-score-4')
    expect(within(overview).getByRole('img', { name: 'Mon 2 Nov: score 0.3' })).toHaveClass('bg-score-0')
    expect(within(overview).getByRole('img', { name: 'Tue 3 Nov: score 1.0' })).toHaveClass('bg-score-2')
    expect(within(overview).getByRole('img', { name: 'Wed 4 Nov: score 1.3' })).toHaveClass('bg-score-3')
    expect(within(overview).getByRole('img', { name: 'Thu 5 Nov: score 0.5' })).toHaveClass('bg-score-1')
    expect(within(overview).getByRole('img', { name: 'Fri 6 Nov: no score' })).toHaveClass('bg-surface')
    // 1 Nov 2026 is a Sunday: six blanks before it.
    expect(overview.querySelectorAll('[data-blank]')).toHaveLength(6)
  })

  it('shows the distribution and per-habit heatmaps', async () => {
    api()
    renderWithProviders(<MonthPanel />, { route: '/progress?view=month' })

    const distribution = await screen.findByRole('region', { name: 'Distribution' })
    expect(within(distribution).getByRole('listitem', { name: 'Green 2' })).toBeInTheDocument()
    const read = screen.getByRole('region', { name: 'Read' })
    expect(read).toHaveTextContent('50% green')
    expect(within(read).getByRole('img', { name: 'Read, Sun 1 Nov, Target hit' })).toHaveClass('bg-cell-green')
    expect(within(read).getByRole('img', { name: 'Read, Mon 2 Nov, Missed' })).toHaveClass('bg-cell-red')
  })

  it('moves between months', async () => {
    const fetchMock = api()
    const { user } = renderWithProviders(<MonthPanel />, { route: '/progress?view=month' })

    await user.click(await screen.findByRole('button', { name: 'Next month' }))

    expect(await screen.findByRole('button', { name: 'This month' })).toBeInTheDocument()
    expect(requests(fetchMock).map((r) => r.url)).toContain('/api/stats/month?month=2026-12')
  })
})
```

`web/src/features/progress/ProgressPage.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { MonthView, WeekView } from '../../api/types'
import { jsonResponse, stubApi } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { ProgressPage } from './ProgressPage'

const empty = { green: 0, yellow: 0, red: 0, grey: 0, total: 0 }
const week: WeekView = { start: '2026-11-16', today: '2026-11-18', distribution: empty, habits: [] }
const month: MonthView = { month: '2026-11', distribution: empty, overview: [], habits: [] }

function api() {
  return stubApi(({ url }) => {
    if (url.startsWith('/api/stats/week')) return jsonResponse(week)
    if (url.startsWith('/api/stats/month')) return jsonResponse(month)
    if (url === '/api/stats/streaks') return jsonResponse([])
    return undefined
  })
}

describe('ProgressPage', () => {
  it('starts on the week and switches to the month', async () => {
    api()
    const { user } = renderWithProviders(<ProgressPage />, { route: '/progress' })

    const views = screen.getByRole('group', { name: 'View' })
    expect(within(views).getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByRole('heading', { name: '16 – 22 Nov 2026' })).toBeInTheDocument()

    await user.click(within(views).getByRole('button', { name: 'Month' }))

    expect(within(views).getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument()
  })

  it('opens on the month from the URL and goes back to the week', async () => {
    api()
    const { user } = renderWithProviders(<ProgressPage />, { route: '/progress?view=month' })

    expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Week' }))

    expect(await screen.findByRole('heading', { name: '16 – 22 Nov 2026' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd web && npx vitest run src/features/progress`
Expected: FAIL — `./MonthPanel` cannot be resolved, and the `ProgressPage` tests find no "View" group.

- [ ] **Step 3: Implement the calendar grid**

`web/src/features/progress/CalendarGrid.tsx`:
```tsx
import { dayOfMonth, weekdayIndex, WEEKDAYS } from '../../lib/dates'

export interface CalendarDay {
  date: string
  className: string
  label: string
}

/**
 * Daily score (GREEN = 2, YELLOW = 1, RED/GREY = 0, averaged over habits due that day) on a five-step
 * red → green scale. Thresholds are explicit so 1.25 lands in step 3 without float surprises.
 */
export function scoreClass(score: number | null): string {
  if (score === null) return 'bg-surface text-dim'
  if (score < 0.4) return 'bg-score-0 text-bg'
  if (score < 0.8) return 'bg-score-1 text-bg'
  if (score < 1.2) return 'bg-score-2 text-bg'
  if (score < 1.6) return 'bg-score-3 text-bg'
  return 'bg-score-4 text-bg'
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
    <div className={`grid grid-cols-7 ${compact ? 'gap-[3px]' : 'gap-1.5'}`}>
      {!compact && WEEKDAYS.map((weekday) => (
        <div key={weekday} className="pb-1 text-center text-[11px] font-medium text-muted" aria-hidden="true">
          {weekday.charAt(0)}
        </div>
      ))}
      {Array.from({ length: blanks }, (_, i) => <div key={`blank-${i}`} data-blank />)}
      {days.map((day) => (
        <div key={day.date} role="img" aria-label={day.label}
          className={`aspect-square ${compact ? 'rounded-[3px]' : 'rounded-[8px] p-1 text-[11px] font-semibold'} ${day.className}`}>
          {showNumbers && dayOfMonth(day.date)}
        </div>
      ))}
    </div>
  )
}

export default CalendarGrid
```

- [ ] **Step 4: Implement the month panel**

`web/src/features/progress/MonthPanel.tsx`:
```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useSearchParams } from 'react-router'
import type { MonthHabit } from '../../api/types'
import { cellClass, STATE_LABEL } from '../../lib/cells'
import { addMonths, formatDay, formatMonth } from '../../lib/dates'
import { card, cardTitle, pillButton } from '../../lib/ui'
import { useMonth } from '../stats/api'
import { DistributionDonut } from '../stats/DistributionDonut'
import { CalendarGrid, scoreClass } from './CalendarGrid'

const iconButton = 'flex h-9 w-9 flex-none items-center justify-center rounded-full bg-card text-fg'

/** Share of due periods (GREEN/YELLOW/RED/GREY) that were GREEN, or null when nothing was due. */
function greenShare(habit: MonthHabit): number | null {
  const due = habit.cells.filter(({ state }) => ['GREEN', 'YELLOW', 'RED', 'GREY'].includes(state)).length
  if (due === 0) return null
  return Math.round((habit.cells.filter(({ state }) => state === 'GREEN').length * 100) / due)
}

export function MonthPanel() {
  const [searchParams, setSearchParams] = useSearchParams()
  const month = searchParams.get('month') ?? undefined
  const { data, isPending, isError } = useMonth(month)

  if (isPending) return <p className="text-muted">Loading…</p>
  if (isError) return <p role="alert" className="text-cell-red">Couldn't load this month.</p>

  const goTo = (target: string) => setSearchParams({ view: 'month', month: target })
  const overview = data.overview.map(({ date, score }) => ({
    date,
    className: scoreClass(score),
    label: `${formatDay(date)}: ${score === null ? 'no score' : `score ${score.toFixed(1)}`}`,
  }))

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button type="button" aria-label="Previous month" className={iconButton}
          onClick={() => goTo(addMonths(data.month, -1))}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <h2 className="min-w-0 flex-1 text-center text-[17px] font-semibold text-fg md:flex-none md:px-2">
          {formatMonth(data.month)}
        </h2>
        <button type="button" aria-label="Next month" className={iconButton}
          onClick={() => goTo(addMonths(data.month, 1))}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        {month && (
          <button type="button" className={pillButton} onClick={() => setSearchParams({ view: 'month' })}>
            This month
          </button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-label="Daily score" className={card}>
          <h3 className={cardTitle}>Daily score</h3>
          <CalendarGrid days={overview} showNumbers />
          <div className="mt-4 flex items-center gap-2 text-[11px] text-muted" aria-hidden="true">
            <span>Missed</span>
            <span className="h-2 flex-1 rounded-full bg-linear-to-r from-score-0 via-score-2 to-score-4" />
            <span>Target</span>
          </div>
        </section>
        <div className="flex flex-col gap-4">
          <DistributionDonut title="Distribution" distribution={data.distribution} />
          {data.habits.length > 0 && (
            <div className={`${card} grid grid-cols-2 gap-4 sm:grid-cols-3`}>
              {data.habits.map((habit) => {
                const share = greenShare(habit)
                return (
                  <section key={habit.id} aria-label={habit.name}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-1">
                      <h3 className="truncate text-[13px] font-semibold text-fg">{habit.name}</h3>
                      <span className="flex-none text-[11px] text-muted">{share === null ? '–' : `${share}% green`}</span>
                    </div>
                    <CalendarGrid compact days={habit.cells.map(({ date, state }) => ({
                      date,
                      className: state === 'PENDING' || state === 'NOT_DUE' ? 'bg-surface' : cellClass(state),
                      label: `${habit.name}, ${formatDay(date)}, ${STATE_LABEL[state]}`,
                    }))} />
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MonthPanel
```

> `1.25.toFixed(1)` is `"1.3"` in V8 (the test relies on it); if a runtime prints `"1.2"`, change the fixture score to `1.3` rather than the rounding.

- [ ] **Step 5: Add the Week | Month switch**

`web/src/features/progress/ProgressPage.tsx` (replace):
```tsx
import { useSearchParams } from 'react-router'
import { pageTitle } from '../../lib/ui'
import { MonthPanel } from './MonthPanel'
import { WeekPanel } from './WeekPanel'

function segmentClass(active: boolean): string {
  return `flex-1 rounded-[10px] px-4 py-1.5 text-[14px] font-semibold transition-colors ${
    active ? 'bg-surface text-fg' : 'text-muted'
  }`
}

/** Week (default) or Month (`?view=month`); each panel keeps its own `start` / `month` parameter. */
export function ProgressPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const isMonth = searchParams.get('view') === 'month'

  return (
    <section className="max-w-5xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h1 className={pageTitle}>Progress</h1>
        <div role="group" aria-label="View" className="flex w-full rounded-xl bg-card p-1 md:w-64">
          <button type="button" aria-pressed={!isMonth} className={segmentClass(!isMonth)}
            onClick={() => setSearchParams({})}>Week</button>
          <button type="button" aria-pressed={isMonth} className={segmentClass(isMonth)}
            onClick={() => setSearchParams({ view: 'month' })}>Month</button>
        </div>
      </div>
      {isMonth ? <MonthPanel /> : <WeekPanel />}
    </section>
  )
}

export default ProgressPage
```

- [ ] **Step 6: Run tests, lint and build**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add web
git commit -m "feat(web): add progress month view and week/month switch" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: Account (profile, timezone, password, log out)

Matches the "Account" frame of the mockups. The route stays `/settings`; the nav label is **Account**.

**Files:**
- Create: `web/src/features/account/AccountPage.tsx`
- Modify: `web/src/app/router.tsx` (add `/settings`)
- Test: `web/src/features/account/AccountPage.test.tsx`

**Interfaces:**
- Consumes: `useSession` (`me`, `setMe`, `logout`), `browserTimezone` (Task 2); `card`, `cardTitle`, `inputClass`, `pageTitle`, `primaryButton`, `secondaryButton` (Task 2); `api`, `messageFor`, `Me` (Task 1).
- Produces: `AccountPage` at `/settings` with the only "Log out" button in the app.

- [ ] **Step 1: Write the failing test**

`web/src/features/account/AccountPage.test.tsx`:
```tsx
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { browserTimezone } from '../auth/session'
import { jsonResponse, problemResponse, requests, stubApi } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { AccountPage } from './AccountPage'

describe('AccountPage', () => {
  it('shows the account', () => {
    stubApi(() => undefined)
    renderWithProviders(<AccountPage />, { route: '/settings' })

    expect(screen.getByRole('heading', { level: 1, name: 'Account' })).toBeInTheDocument()
    expect(screen.getByText('bob')).toBeInTheDocument()
    expect(screen.getByLabelText('Timezone')).toHaveValue('Asia/Kolkata')
  })

  it('saves the timezone, defaulting to this device', async () => {
    const fetchMock = stubApi(({ method, body }) =>
      method === 'PUT' ? jsonResponse({ username: 'bob', ...(body as object) }) : undefined,
    )
    const { user } = renderWithProviders(<AccountPage />, { route: '/settings' })

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
    const { user } = renderWithProviders(<AccountPage />, { route: '/settings' })

    await user.type(screen.getByLabelText('Current password'), 'old-password')
    await user.type(screen.getByLabelText('New password'), 'new-password')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Password changed')
    expect(screen.getByLabelText('Current password')).toHaveValue('')
    expect(requests(fetchMock)[0].body).toEqual({ currentPassword: 'old-password', newPassword: 'new-password' })
  })

  it('shows a wrong current password', async () => {
    stubApi(() => problemResponse(400, 'VALIDATION', 'currentPassword: is incorrect'))
    const { user } = renderWithProviders(<AccountPage />, { route: '/settings' })

    await user.type(screen.getByLabelText('Current password'), 'nope-nope')
    await user.type(screen.getByLabelText('New password'), 'new-password')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('currentPassword: is incorrect')
  })

  it('logs out', async () => {
    const fetchMock = stubApi(({ url }) => (url === '/api/auth/logout' ? new Response(null, { status: 200 }) : undefined))
    const { user } = renderWithProviders(<AccountPage />, { route: '/settings' })

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByTestId('location-display')).toHaveTextContent('/login')
    expect(requests(fetchMock)).toContainEqual({ method: 'POST', url: '/api/auth/logout', body: undefined })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npx vitest run src/features/account`
Expected: FAIL — `./AccountPage` cannot be resolved.

- [ ] **Step 3: Implement the page and route**

`web/src/features/account/AccountPage.tsx`:
```tsx
import { useQueryClient } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { api } from '../../api/client'
import { messageFor } from '../../api/errors'
import type { Me } from '../../api/types'
import { card, cardTitle, inputClass, pageTitle, primaryButton, secondaryButton } from '../../lib/ui'
import { browserTimezone, useSession } from '../auth/session'

type Feedback = { kind: 'ok' | 'error'; text: string } | null

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null
  return feedback.kind === 'ok'
    ? <p role="status" className="mt-3 text-sm text-cell-green">{feedback.text}</p>
    : <p role="alert" className="mt-3 text-sm text-cell-red">{feedback.text}</p>
}

/** Every timezone the browser knows, for the datalist (empty on very old browsers). */
function timezones(): string[] {
  return typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
}

export function AccountPage() {
  const { me, setMe, logout } = useSession()
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
      // "Today" and every countdown may have moved, so every stats view is stale.
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

  const label = 'mb-1.5 block text-[13px] font-medium text-muted'
  return (
    <section className="max-w-lg">
      <h1 className={`${pageTitle} mb-5`}>Account</h1>
      <div className={`${card} mb-4 flex items-center gap-4`}>
        <span aria-hidden="true"
          className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-linear-to-br from-accent to-[#bf5af2] text-lg font-bold text-white">
          {me?.username.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold text-fg">{me?.username}</p>
          <p className="truncate text-[13px] text-muted">{me?.timezone}</p>
        </div>
      </div>
      <form className={`${card} mb-4`} onSubmit={(event) => void saveTimezone(event)}>
        <h2 className={cardTitle}>Timezone</h2>
        <label htmlFor="timezone" className="sr-only">Timezone</label>
        <input id="timezone" list="timezones" required value={timezone}
          onChange={(e) => setTimezone(e.target.value)} className={inputClass} />
        <datalist id="timezones">
          {timezones().map((zone) => <option key={zone} value={zone} />)}
        </datalist>
        <p className="mt-2 text-xs text-dim">Days (and countdowns) end at midnight in this timezone.</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setTimezone(browserTimezone())} className={secondaryButton}>
            Use this device
          </button>
          <button type="submit" className={primaryButton}>Save timezone</button>
        </div>
        <FeedbackLine feedback={tzFeedback} />
      </form>
      <form className={`${card} mb-4`} onSubmit={(event) => void changePassword(event)}>
        <h2 className={cardTitle}>Change password</h2>
        <div className="mb-3">
          <label htmlFor="current-password" className={label}>Current password</label>
          <input id="current-password" type="password" autoComplete="current-password" required
            value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} />
        </div>
        <div className="mb-4">
          <label htmlFor="new-password" className={label}>New password</label>
          <input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128}
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
        </div>
        <button type="submit" className={primaryButton}>Change password</button>
        <FeedbackLine feedback={pwFeedback} />
      </form>
      <button type="button" onClick={() => void logout()}
        className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-line bg-card px-4 py-3 text-[15px] font-semibold text-cell-red">
        <LogOut size={18} aria-hidden="true" />
        Log out
      </button>
    </section>
  )
}

export default AccountPage
```

`web/src/app/router.tsx`: import `AccountPage` and add, inside the `Shell` route:
```tsx
import { AccountPage } from '../features/account/AccountPage'
// …
        <Route path="/settings" element={<AccountPage />} />
```

- [ ] **Step 4: Run tests, lint and build**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat(web): add account page with timezone, password and log out" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 8: End-to-end test, Docker image, Render blueprint and README

**Files:**
- Create: `web/e2e/habit.spec.ts`, `Dockerfile`, `.dockerignore`, `render.yaml`
- Modify: `README.md` (append "Frontend" and "Deployment")

**Interfaces:**
- Consumes: every page from Tasks 2–7; the shell's "Tabs" nav (Task 2); Today's `article` / `Target` / `aria-pressed` / `data-tone` / `"N of M done"` (Task 5); week cell labels with `aria-current="date"` and the donut legend `"Green 1"` (Task 4); the `Month` switch and `role="img"` month cells (Task 6); the backend from the backend plan (`/api/public/health`, `SpaWebConfig`, `COOKIE_SECURE`, Gradle project `api`).
- Produces: the deployable image and the Render Blueprint.

- [ ] **Step 1: Write the end-to-end test**

`web/e2e/habit.spec.ts`:
```ts
import { expect, test } from '@playwright/test'

test('sign up, create a habit, mark it on Today and see it in Progress', async ({ page }) => {
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

  const tabs = page.getByRole('navigation', { name: 'Tabs' })
  await tabs.getByRole('link', { name: 'Today' }).click()
  const card = page.getByRole('article', { name: 'Read' })
  await expect(card.locator('[data-tone]')).toBeVisible()
  await card.getByRole('button', { name: 'Target', exact: true }).click()
  await expect(card.getByRole('button', { name: 'Target', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(card.locator('[data-tone]')).toHaveAttribute('data-tone', 'done')
  await expect(page.getByRole('img', { name: '1 of 1 done' })).toBeVisible()

  await tabs.getByRole('link', { name: 'Progress' }).click()
  const today = page.getByRole('button', { name: /^Read, / }).and(page.locator('[aria-current="date"]'))
  await expect(today).toHaveAccessibleName(/Target hit$/)
  await expect(page.getByRole('listitem', { name: 'Green 1' })).toBeVisible()

  await page.getByRole('button', { name: 'Month', exact: true }).click()
  await expect(page.getByRole('img', { name: /^Read, .*, Target hit$/ })).toBeVisible()
})
```

Playwright (copied config) runs a phone-sized Chromium (so the bottom "Tabs" nav is the visible one) and starts only the Vite dev server, so the API must already be running with a database (see the README "Frontend" section). Each run signs up a fresh user, so it is rerunnable.

- [ ] **Step 2: Run it**

Run (two terminals, from the repo root):
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
curl -s -o /dev/null -w '%{http_code}\n' localhost:8090/progress
docker stop chronos-check
```
Expected: `{"status":"UP"}` then `200` (client route served by `index.html`).

> Rancher Desktop: if `docker` can't reach the daemon, export `DOCKER_HOST=unix://$HOME/.rd/docker.sock` first.

- [ ] **Step 5: Append the README sections**

Append to `README.md`:
````markdown

## Frontend (`web/`)

Vite + React 19 + TypeScript, TanStack Query, react-router, Tailwind CSS 4, lucide-react icons, Inter
(self-hosted via @fontsource). Dark theme only. Requires Node 22+.

```bash
cd web
npm install
npm run dev        # http://localhost:5173, proxies /api to the backend on :8080
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
Then ask the user to open http://localhost:5173 (phone width and desktop width), sign up, and check Today (tap
Target/Minimum/Missed, the countdown chip), Progress (Week and Month), Habits and Account against the mockups.
Deploying to Render/Neon needs the user's accounts; walk them through the README steps rather than doing it for them.
