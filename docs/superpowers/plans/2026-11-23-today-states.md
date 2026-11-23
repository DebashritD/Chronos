# Today Summary States + Geist Headings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Today ring card with a borderless, state-driven summary and switch headings from Sora to Geist 600.

**Architecture:** A pure `todaySummary()` derives headline/line/countdown/segments from Today items, the clock and
streaks; a dumb `TodaySummary` component renders it inside `TodayPage`. The font swap is CSS/token/class-only.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Vitest + Testing Library, @fontsource.

Spec: `docs/superpowers/specs/2026-11-23-today-states-design.md`. All commands run from `web/`.

## Global Constraints

- Copy uses curly apostrophes (’) exactly as written in this plan; no exclamation marks.
- Red never colours text; only states "Go green" and "All green" use `text-cell-green` for the headline.
- No border or card background on the summary.
- Commits are SSH-signed; end every commit message with `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.
- Validation: `npx vitest run && npm run lint && npm run build` must pass at the end of each task.

---

### Task 1: `todaySummary` pure function

**Files:**
- Create: `web/src/features/today/todaySummary.ts`
- Test: `web/src/features/today/todaySummary.test.ts`

**Interfaces:**
- Consumes: `TodayItem` from `./todayItems`; `isColor` from `../../lib/cells`; `isUrgent` from `../../lib/timeLeft`.
- Produces: `export interface Summary { headline: string; line: string; tone: 'default' | 'green'; countdown: { text: string; urgent: boolean } | null; segments: CellState[]; label: string }` and
  `export function todaySummary(items: TodayItem[], now: Date, streakOf: (habitId: number) => number | undefined): Summary`.

- [ ] **Step 1: Write the failing tests** — `web/src/features/today/todaySummary.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { CellState } from '../../api/types'
import type { TodayItem } from './todayItems'
import { todaySummary } from './todaySummary'

const NOW = new Date('2026-11-18T06:30:00Z') // 12h before the 18:30Z close
const LATE = new Date('2026-11-18T16:00:00Z') // 2h30m left
const CLOSE = '2026-11-18T18:30:00Z'
const NAMES = ['Run', 'Read', 'Meditate', 'Stretch', 'Walk']

function item(id: number, state: CellState, closesAt = CLOSE): TodayItem {
  return {
    habit: { id, name: NAMES[id - 1], minText: '', targetText: '', frequency: 'DAILY', intervalDays: null, status: 'ACTIVE',
      current: null, cells: [] },
    cell: { date: '2026-11-18', periodStart: '2026-11-18', state, editable: true, note: null, closesAt },
  }
}
const day = (...states: CellState[]) => states.map((s, i) => item(i + 1, s))
const none = () => undefined
const at = (iso: string) => new Date(iso)

describe('todaySummary', () => {
  it('has nothing due', () => {
    expect(todaySummary([], NOW, none)).toMatchObject({ headline: 'Nothing due today', line: 'Enjoy the break.', countdown: null })
  })

  it('starts the day', () => {
    const s = todaySummary(day('PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING'), NOW, none)
    expect(s).toMatchObject({ headline: 'Let’s start', line: '5 habits today. The minimum counts.', tone: 'default',
      countdown: { text: '12h left', urgent: false }, label: '0 of 5 marked' })
    expect(todaySummary(day('PENDING'), NOW, none).line).toBe('1 habit today. The minimum counts.')
  })

  it('is a good start up to half', () => {
    const s = todaySummary(day('GREEN', 'YELLOW', 'PENDING', 'PENDING', 'PENDING'), NOW, none)
    expect(s).toMatchObject({ headline: 'Good start', line: '2 of 5 marked. 3 to go.', label: '2 of 5 marked: 1 target, 1 minimum',
      segments: ['GREEN', 'YELLOW', 'PENDING', 'PENDING', 'PENDING'] })
  })

  it('says go green when most are marked on target', () => {
    expect(todaySummary(day('GREEN', 'GREEN', 'GREEN', 'PENDING', 'PENDING'), NOW, none))
      .toMatchObject({ headline: 'Go green', line: 'Almost there. 3 of 5 on target.', tone: 'green' })
  })

  it('says almost there when most are marked with a minimum', () => {
    expect(todaySummary(day('GREEN', 'YELLOW', 'GREEN', 'PENDING', 'PENDING'), NOW, none))
      .toMatchObject({ headline: 'Almost there', line: '3 of 5 marked. 2 to go.', tone: 'default' })
  })

  it('names the last one, even after a miss', () => {
    expect(todaySummary(day('GREEN', 'GREEN', 'YELLOW', 'GREEN', 'PENDING'), NOW, none))
      .toMatchObject({ headline: 'Walk is the last one', line: 'Mark it to close the day.' })
    expect(todaySummary(day('RED', 'GREEN', 'GREEN', 'GREEN', 'PENDING'), NOW, none).headline).toBe('Walk is the last one')
  })

  it('stays kind after a miss', () => {
    expect(todaySummary(day('RED', 'PENDING', 'PENDING', 'PENDING', 'PENDING'), NOW, none))
      .toMatchObject({ headline: 'Still in it', line: '1 missed. The other 4 can stay off red.' })
  })

  it('counts down when late, naming only the habits closing soon', () => {
    const s = todaySummary(day('GREEN', 'GREEN', 'YELLOW', 'PENDING', 'PENDING'), LATE, none)
    expect(s).toMatchObject({ headline: '2 hours left', line: 'Stretch and Walk are still open.', countdown: { text: '2h left', urgent: true } })
    expect(todaySummary(day('GREEN', 'GREEN', 'YELLOW', 'GREEN', 'PENDING'), LATE, none).line).toBe('Walk is still open.')
    expect(todaySummary(day('GREEN', 'GREEN', 'PENDING', 'PENDING', 'PENDING'), LATE, none).line).toBe('3 habits are still open.')
    const weekly = [...day('GREEN', 'GREEN', 'YELLOW'), item(4, 'PENDING', '2026-11-22T18:30:00Z'), item(5, 'PENDING')]
    expect(todaySummary(weekly, LATE, none).line).toBe('Walk is still open.')
    expect(todaySummary(day('GREEN', 'PENDING'), at('2026-11-18T17:00:00Z'), none).headline).toBe('1 hour left')
    const s30 = todaySummary(day('GREEN', 'PENDING'), at('2026-11-18T18:00:00Z'), none)
    expect(s30).toMatchObject({ headline: '30 minutes left', countdown: { text: '30m left', urgent: true } })
  })

  it('guards the longest streak at risk when late', () => {
    const streaks: Record<number, number> = { 4: 12, 5: 8 }
    expect(todaySummary(day('GREEN', 'GREEN', 'YELLOW', 'PENDING', 'PENDING'), LATE, (id) => streaks[id]))
      .toMatchObject({ headline: 'Keep the 12-day streak', line: 'Stretch is still open.' })
    expect(todaySummary(day('GREEN', 'GREEN', 'YELLOW', 'PENDING', 'PENDING'), LATE, () => 6).headline).toBe('2 hours left')
  })

  it('says there is still time when late and nothing is marked', () => {
    expect(todaySummary(day('PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING'), LATE, none))
      .toMatchObject({ headline: 'There’s still time', line: 'A minimum on each keeps all 5 off red.' })
    expect(todaySummary(day('PENDING'), LATE, none).line).toBe('A minimum keeps it off red.')
  })

  it('closes the day three ways', () => {
    expect(todaySummary(day('GREEN', 'GREEN', 'GREEN', 'GREEN', 'GREEN'), NOW, none))
      .toMatchObject({ headline: 'All green', line: '5 of 5 on target today.', tone: 'green', countdown: null })
    expect(todaySummary(day('GREEN', 'YELLOW', 'GREEN', 'YELLOW', 'GREEN'), NOW, none))
      .toMatchObject({ headline: 'All done', line: '3 on target, 2 at minimum. All off red.', tone: 'default' })
    expect(todaySummary(day('GREEN', 'GREEN', 'RED', 'GREEN', 'YELLOW'), NOW, none)).toMatchObject({ headline: 'All marked',
      line: '4 off red, 1 missed. Tomorrow resets.', label: '5 of 5 marked: 3 target, 1 minimum, 1 missed', countdown: null })
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/features/today/todaySummary.test.ts` — expect FAIL (module not found).

- [ ] **Step 3: Implement** — `web/src/features/today/todaySummary.ts`:

```ts
import type { CellState } from '../../api/types'
import { isColor } from '../../lib/cells'
import { isUrgent } from '../../lib/timeLeft'
import type { TodayItem } from './todayItems'

export interface Summary {
  headline: string
  line: string
  tone: 'default' | 'green'
  countdown: { text: string; urgent: boolean } | null
  segments: CellState[]
  label: string
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const STREAK_AT_RISK = 7

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`

function shortLeft(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.floor(ms / MINUTE))}m left`
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h left`
  return `${Math.floor(ms / DAY)}d left`
}

function longLeft(ms: number): string {
  return ms < HOUR ? `${plural(Math.max(1, Math.floor(ms / MINUTE)), 'minute')} left` : `${plural(Math.floor(ms / HOUR), 'hour')} left`
}

function stillOpen(items: TodayItem[]): string {
  if (items.length === 1) return `${items[0].habit.name} is still open.`
  if (items.length === 2) return `${items[0].habit.name} and ${items[1].habit.name} are still open.`
  return `${items.length} habits are still open.`
}

/** The Today headline, line, countdown and segments for the day's progress. First matching state wins (see spec). */
export function todaySummary(items: TodayItem[], now: Date, streakOf: (habitId: number) => number | undefined): Summary {
  const total = items.length
  const count = (state: CellState) => items.filter(({ cell }) => cell.state === state).length
  const green = count('GREEN')
  const yellow = count('YELLOW')
  const red = count('RED')
  const marked = green + yellow + red
  const open = items.filter(({ cell }) => !isColor(cell.state))
  const urgentOpen = open.filter(({ cell }) => cell.closesAt !== null && isUrgent(cell.closesAt, now))
  const closes = open.map(({ cell }) => (cell.closesAt ? Date.parse(cell.closesAt) : NaN))
    .filter((t) => !Number.isNaN(t) && t > now.getTime())
  const msLeft = closes.length > 0 ? Math.min(...closes) - now.getTime() : null

  const parts = [[green, 'target'], [yellow, 'minimum'], [red, 'missed']]
    .filter(([n]) => (n as number) > 0).map(([n, word]) => `${n} ${word}`)
  const base = {
    segments: items.map(({ cell }) => cell.state),
    label: `${marked} of ${total} marked${parts.length > 0 ? `: ${parts.join(', ')}` : ''}`,
    countdown: msLeft === null ? null : { text: shortLeft(msLeft), urgent: urgentOpen.length > 0 },
  }
  const say = (headline: string, line: string, tone: Summary['tone'] = 'default'): Summary => ({ ...base, headline, line, tone })

  if (total === 0) return say('Nothing due today', 'Enjoy the break.')
  if (open.length === 0) {
    if (red > 0) return say('All marked', `${total - red} off red, ${red} missed. Tomorrow resets.`)
    if (yellow === 0) return say('All green', `${total} of ${total} on target today.`, 'green')
    return say('All done', `${green} on target, ${yellow} at minimum. All off red.`)
  }
  if (urgentOpen.length > 0 && msLeft !== null) {
    const atRisk = urgentOpen
      .map((item) => ({ item, streak: streakOf(item.habit.id) ?? 0 }))
      .filter(({ streak }) => streak >= STREAK_AT_RISK)
      .reduce<{ item: TodayItem; streak: number } | null>((best, next) => (best && best.streak >= next.streak ? best : next), null)
    if (atRisk) return say(`Keep the ${atRisk.streak}-day streak`, `${atRisk.item.habit.name} is still open.`)
    if (marked === 0) {
      return say('There’s still time', total === 1 ? 'A minimum keeps it off red.' : `A minimum on each keeps all ${total} off red.`)
    }
    return say(longLeft(msLeft), stillOpen(urgentOpen))
  }
  if (open.length === 1 && marked > 0) return say(`${open[0].habit.name} is the last one`, 'Mark it to close the day.')
  if (red > 0) return say('Still in it', `${red} missed. The other ${open.length} can stay off red.`)
  if (marked === 0) return say('Let’s start', `${plural(total, 'habit')} today. The minimum counts.`)
  const progress = `${marked} of ${total} marked. ${open.length} to go.`
  if (marked > total / 2) {
    return yellow === 0 && red === 0
      ? say('Go green', `Almost there. ${marked} of ${total} on target.`, 'green')
      : say('Almost there', progress)
  }
  return say('Good start', progress)
}
```

- [ ] **Step 4: Run** `npx vitest run src/features/today/todaySummary.test.ts` — expect PASS. Then `npm run lint`.

- [ ] **Step 5: Commit** `git add src/features/today/todaySummary.ts src/features/today/todaySummary.test.ts && git commit -m "Derive Today summary states"` (with trailer).

---

### Task 2: Borderless `TodaySummary` on the Today page

**Files:**
- Create: `web/src/features/today/TodaySummary.tsx`
- Modify: `web/src/features/today/TodayPage.tsx` (remove `encouragement`, the ring `<section>`, `ProgressRing` import, `marks`/`marked`/`count`)
- Delete: `web/src/features/today/ProgressRing.tsx`
- Test: `web/src/features/today/TodayPage.test.tsx`

**Interfaces:**
- Consumes: `todaySummary`, `Summary` from `./todaySummary` (Task 1).
- Produces: `export function TodaySummary({ summary }: { summary: Summary })`.

- [ ] **Step 1: Update the failing tests** in `TodayPage.test.tsx`:
  - In "shows the date, today's progress and one card per habit due today", replace the two lines
    `expect(screen.getByRole('img', { name: '1 of 5 marked (1 target)' }))…` and
    `expect(screen.getByText('4 habits left today. Even the minimum counts.'))…` with:
    ```ts
    const progress = screen.getByRole('region', { name: "Today's progress" })
    expect(within(progress).getByRole('heading', { name: 'Good start' })).toBeInTheDocument()
    expect(within(progress).getByText('1 of 5 marked. 4 to go.')).toBeInTheDocument()
    expect(within(progress).getByText('12h left')).toBeInTheDocument()
    expect(within(progress).getByRole('img', { name: '1 of 5 marked: 1 target' })).toBeInTheDocument()
    ```
  - In "celebrates when everything is marked", replace the two expectations with:
    ```ts
    expect(await screen.findByRole('img', { name: '1 of 1 marked: 1 target' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'All green' })).toBeInTheDocument()
    ```
  - Leave "answers a miss…" asserting heading `All marked` unchanged.

- [ ] **Step 2: Run** `npx vitest run src/features/today/TodayPage.test.tsx` — expect those two tests to FAIL.

- [ ] **Step 3: Create** `web/src/features/today/TodaySummary.tsx`:

```tsx
import type { CellState } from '../../api/types'
import type { Summary } from './todaySummary'

const SEGMENT: Partial<Record<CellState, string>> = { GREEN: 'bg-cell-green', YELLOW: 'bg-cell-yellow', RED: 'bg-cell-red' }

/** Borderless summary above the Today cards: state headline, a line, the countdown and one segment per habit. */
export function TodaySummary({ summary }: { summary: Summary }) {
  const { headline, line, tone, countdown, segments, label } = summary
  return (
    <section aria-label="Today's progress" className="mb-5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className={`text-[26px] leading-tight font-semibold tracking-[-0.035em] ${tone === 'green' ? 'text-cell-green' : 'text-fg'}`}>
            {headline}
          </h2>
          <p className="mt-1 text-[15px] leading-snug text-muted">{line}</p>
        </div>
        {countdown && (
          <span className={`mb-0.5 flex-none text-[13px] ${countdown.urgent ? 'text-accent' : 'text-dim'}`}>{countdown.text}</span>
        )}
      </div>
      {segments.length > 0 && (
        <div role="img" aria-label={label} className="mt-3.5 flex gap-1">
          {segments.map((state, i) => (
            <span key={i} className={`h-[5px] flex-1 rounded-full ${SEGMENT[state] ?? 'bg-cell-grey'}`} />
          ))}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Wire into `TodayPage.tsx`:**
  - Delete the `encouragement` function and the `import { ProgressRing } from './ProgressRing'` line; delete the
    now-unused `Color` and `isColor` imports if nothing else uses them.
  - Add imports: `import { TodaySummary } from './TodaySummary'` and `import { todaySummary } from './todaySummary'`.
  - Replace the lines from `const count = …` through `const streakFor = …` with:
    ```ts
    const streakFor = (habitId: number) => streaks.data?.find((s) => s.habitId === habitId)
    const summary = todaySummary(items, now, (habitId) => streakFor(habitId)?.current)
    ```
  - Replace the whole `<section aria-label="Today's progress" …>…</section>` with `<TodaySummary summary={summary} />`.
  - Delete `web/src/features/today/ProgressRing.tsx` (`git rm`).

- [ ] **Step 5: Run** `npx vitest run && npm run lint && npm run build` — expect all PASS.

- [ ] **Step 6: Commit** `git add -A src/features/today && git commit -m "Borderless, state-driven Today summary"` (with trailer).

---

### Task 3: Geist 600 headings app-wide

**Files:**
- Modify: `web/package.json`, `web/package-lock.json` (via npm), `web/src/main.tsx`, `web/src/index.css`, `web/src/lib/ui.ts`,
  `web/src/app/YellowLimitProvider.tsx:28`, `web/src/app/EmptyState.tsx:24`, `web/src/app/NotFound.tsx:6`,
  `web/src/features/progress/MonthPanel.tsx:76`, `web/src/features/progress/WeekTiles.tsx:50,54`,
  `web/src/features/today/HabitCard.tsx:89,97`, `web/src/features/auth/AuthLayout.tsx:10`,
  `web/src/features/habits/HabitsPage.tsx:70`, `web/src/features/checkin/CellPicker.tsx:53`

- [ ] **Step 1: Packages** — `npm install @fontsource/geist && npm uninstall @fontsource/sora`.
- [ ] **Step 2: `main.tsx`** — replace the three `@fontsource/sora/*.css` imports with `import '@fontsource/geist/600.css'`.
- [ ] **Step 3: `index.css`** — set `--font-display: 'Geist', 'Inter', ui-sans-serif, system-ui, sans-serif;` and change
  the heading rule to:
  ```css
  h1, h2, h3, .font-display {
    font-family: var(--font-display);
    font-weight: 600;
    letter-spacing: -0.035em;
  }
  ```
- [ ] **Step 4: Classes** — in `ui.ts` set `pageTitle = 'text-[34px] leading-tight font-semibold text-fg'`; in every file
  listed above replace `font-extrabold` / `font-bold` on those heading/display elements with `font-semibold`, and drop
  `tracking-tight` from `AuthLayout.tsx:10`. (`DistributionDonut.tsx` is Inter body text — leave it.)
- [ ] **Step 5: Verify** — `grep -rn "sora\|Sora" src package.json` returns nothing; `npx vitest run && npm run lint && npm run build` PASS.
- [ ] **Step 6: Commit** `git add -A package.json package-lock.json src && git commit -m "Geist 600 headings"` (with trailer).
