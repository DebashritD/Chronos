# Compact Today + single-card Progress week — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Today cards shorter (no Min/Target line, green habits collapse to a one-line row under "Done") and draw the Progress week's habits inside one card.

**Architecture:** `HabitCard` renders either the full card (not green) or a compact row (green) from the same `<article>` root, so its DOM node and React state survive the switch. `TodayPage` orders non-green before green and inserts a keyed `Done` heading among the cards in one grid, so a card moving into Done keeps its state. `WeekTiles` wraps header + list in one card and turns tiles into divided rows.

**Tech Stack:** React 19, TypeScript, Tailwind v4, TanStack Query v5, Vitest + Testing Library, Playwright.

Spec: `docs/superpowers/specs/2026-11-24-compact-today-design.md`.

## Global Constraints
- Run everything from `web/`. Validation: `npx vitest run && npm run lint && npm run build` (lint has 2 expected `only-export-components` warnings).
- Same layout on mobile and desktop; no `md:`/`lg:` variants for the new layouts.
- Do not change `CellPicker`, `WeekGrid`, `WeekCellButton`, Month view or `TodaySummary`.
- Never `git add` `PRODUCT.md` (untracked at repo root). Commit trailer: `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.

---

### Task 1: Compact Today cards (green collapses)

**Files:**
- Modify: `web/src/features/today/HabitCard.tsx` (full rewrite below)
- Modify: `web/src/features/today/TodayPage.tsx` (card list, ~lines 76–88)
- Modify: `web/src/features/today/TodayPage.test.tsx`
- Modify: `web/e2e/habit.spec.ts` (lines 24–27)

**Interfaces:**
- `HabitCard` props unchanged: `{ habit, cell, streak, now, yellowLimit?, onOpen }`.

- [ ] **Step 1: Update tests to the new behaviour (they must fail first)**

In `TodayPage.test.tsx`:

1a. Add this helper below `chip()`:

```ts
/** The week with one habit's current period (18 Nov) set to `state`; `only` drops the other habits. */
function weekWith(habitId: number, state: WeekCell['state'], only = false): WeekView {
  const habits = week.habits.map((habit) => {
    if (habit.id !== habitId || !habit.current) return habit
    const cells = habit.cells.map((cell) => (cell.date === '2026-11-18' ? { ...cell, state } : cell))
    return { ...habit, current: { ...habit.current, state }, cells }
  })
  return { ...week, habits: only ? habits.filter((habit) => habit.id === habitId) : habits }
}
```

1b. In "shows the date, today's progress and one card per habit due today", replace everything from `const names = …` to the end of the test with:

```ts
    const names = screen.getAllByRole('article').map((article) => within(article).getByRole('heading').textContent)
    expect(names).toEqual(['Run', 'Piano', 'Stretch', 'Swim', 'Read'])
    expect(screen.getByRole('heading', { level: 2, name: 'Done' })).toBeInTheDocument()

    // Read is green: a one-line row with its colour, note and streak, no mark buttons or countdown.
    const read = screen.getByRole('article', { name: 'Read' })
    expect(within(read).queryByRole('button', { name: /^(Target|Minimum|Missed)$/ })).not.toBeInTheDocument()
    expect(read).toHaveTextContent('Target hit')
    expect(read).toHaveTextContent('ch 3')
    expect(read).not.toHaveTextContent('20 pages')
    await waitFor(() => expect(read).toHaveTextContent('Current streak 12'))
    expect(chip(read)).toBeNull()

    const run = screen.getByRole('article', { name: 'Run' })
    expect(run).not.toHaveTextContent('5 km')
    expect(within(run).getByText('Every 3 days')).toBeInTheDocument()
    // Mid-period: the 17–19 Nov period still shows on the 18th.
    expect(chip(run)).toHaveTextContent('1d 12h left in this period')
    expect(chip(run)).toHaveAttribute('data-tone', 'normal')

    const piano = screen.getByRole('article', { name: 'Piano' })
    expect(within(piano).getByText('This week')).toBeInTheDocument()
    expect(chip(piano)).toHaveTextContent('4d 12h left this week')

    const stretch = screen.getByRole('article', { name: 'Stretch' })
    expect(stretch).not.toHaveTextContent('1 pose')
    expect(within(stretch).queryByText(/^(Every \d+ days|This week)$/)).not.toBeInTheDocument()
    expect(chip(stretch)).toHaveTextContent('12h left today')

    const swim = screen.getByRole('article', { name: 'Swim' })
    expect(within(swim).getByText('Every 7 days')).toBeInTheDocument()
    expect(chip(swim)).toHaveTextContent('3d 12h left in this period')
  })
```

1c. In "turns the countdown orange in the last three hours", delete the line
`expect(chip(screen.getByRole('article', { name: 'Read' }))).toHaveAttribute('data-tone', 'done')`.

1d. Replace "marks with one tap, keeping the existing note" with (a red card keeps its note when switched to yellow):

```ts
  it('marks with one tap, keeping the existing note', async () => {
    const red = weekWith(5, 'RED')
    red.habits = red.habits.map((habit) => habit.id === 5 && habit.current
      ? { ...habit, current: { ...habit.current, note: 'sore' } } : habit)
    const fetchMock = api((r) => (r.method === 'PUT' ? jsonResponse({ periodStart: '2026-11-18', color: 'YELLOW', note: 'sore' }) : undefined), red)
    const { user } = renderWithProviders(<TodayPage />)

    const stretch = await screen.findByRole('article', { name: 'Stretch' })
    expect(within(stretch).getByRole('button', { name: 'Missed' })).toHaveAttribute('aria-pressed', 'true')
    expect(stretch).toHaveTextContent('sore')
    await user.click(within(stretch).getByRole('button', { name: 'Minimum' }))

    await waitFor(() =>
      expect(requests(fetchMock).find((r) => r.method === 'PUT')).toEqual({
        method: 'PUT',
        url: '/api/habits/5/check-ins/2026-11-18',
        body: { color: 'YELLOW', note: 'sore' },
      }),
    )
  })
```

(`todayItems` builds the card's `cell` from `habit.current`, so setting the note there is enough.)

1e. Replace "vibrates on a tap and pops the button once saved" with two tests:

```ts
  it('vibrates on a tap and pops the button once saved', async () => {
    const vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    api((r) => (r.method === 'PUT' ? jsonResponse({ periodStart: '2026-11-18', color: 'YELLOW', note: null }) : undefined))
    const { user } = renderWithProviders(<TodayPage />)

    const stretch = await screen.findByRole('article', { name: 'Stretch' })
    await user.click(within(stretch).getByRole('button', { name: 'Minimum' }))

    expect(vibrate).toHaveBeenCalledWith(14)
    await waitFor(() => expect(within(stretch).getByRole('button', { name: 'Minimum' })).toHaveAttribute('data-pop'))
    delete (navigator as { vibrate?: unknown }).vibrate
  })

  it('collapses a habit into Done once it is green, popping the row', async () => {
    let after = false
    api((r) => {
      if (r.method === 'PUT') {
        after = true
        return jsonResponse({ periodStart: '2026-11-18', color: 'GREEN', note: null })
      }
      if (r.url.startsWith('/api/stats/week')) return jsonResponse(after ? weekWith(5, 'GREEN') : week)
      return undefined
    })
    const { user } = renderWithProviders(<TodayPage />)

    const stretch = await screen.findByRole('article', { name: 'Stretch' })
    await user.click(within(stretch).getByRole('button', { name: 'Target' }))

    await waitFor(() => expect(within(stretch).queryByRole('button', { name: 'Target' })).not.toBeInTheDocument())
    expect(stretch).toHaveTextContent('Target hit')
    expect(stretch.querySelector('[data-pop]')).not.toBeNull()
    const names = screen.getAllByRole('article').map((article) => within(article).getByRole('heading').textContent)
    expect(names).toEqual(['Run', 'Piano', 'Swim', 'Read', 'Stretch'])
  })
```

1f. Replace "shows the saved note and edits it in place" and "offers a note only once the habit is marked, and Cancel discards the draft" with:

```ts
  it('edits notes only in the picker, not on the card', async () => {
    api(undefined, weekWith(5, 'YELLOW'))
    renderWithProviders(<TodayPage />)

    const stretch = await screen.findByRole('article', { name: 'Stretch' })
    expect(within(stretch).getByRole('button', { name: 'Minimum' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: /note/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
```

1g. Replace "does nothing when the selected button is tapped again" body so it uses a yellow Stretch:

```ts
  it('does nothing when the selected button is tapped again', async () => {
    const fetchMock = api(undefined, weekWith(5, 'YELLOW'))
    const { user } = renderWithProviders(<TodayPage />)

    const stretch = await screen.findByRole('article', { name: 'Stretch' })
    await user.click(within(stretch).getByRole('button', { name: 'Minimum' }))

    expect(requests(fetchMock).filter((r) => r.method === 'PUT')).toEqual([])
  })
```

1h. Rename "opens the picker from the habit name to add a note" to "opens the picker from a done row to edit its note" (body unchanged — `Read` is now a row whose button is named `Read`).

1i. In "answers a miss with a kind word instead of the pop", switch from Read to Stretch: the stub becomes

```ts
    let state: WeekCell['state'] = 'PENDING'
    api((r) => {
      if (r.method === 'PUT') {
        state = 'RED'
        return jsonResponse({ periodStart: '2026-11-18', color: 'RED', note: null })
      }
      if (r.url.startsWith('/api/stats/week')) return jsonResponse(weekWith(5, state, true))
      return undefined
    })
```

and every `read`/`'Read'` in the test body becomes `stretch`/`'Stretch'`. The assertions (status text, `Missed` without `data-pop`, `All marked` heading) stay.

1j. In "warns when a yellow uses up the limit and badges the card", switch from Read to Stretch: `readRun` → `stretchRun`; PUT response note `null`; streaks entry `{ habitId: 5, name: 'Stretch', current: 3, best: 9, yellowRun: stretchRun, yellowLimit: 2 }`; add before the streaks branch
`if (r.url.startsWith('/api/stats/week')) return jsonResponse(stretchRun === 2 ? weekWith(5, 'YELLOW') : week)`;
`read` → `stretch` (article name `'Stretch'`); dialog text ends `on Stretch. Next time go green, or the streak starts over.`.

1k. In "still warns when the yellow syncs while another mark is queued behind it": rename `readRun` → `runRun`, change `'/api/habits/1/'` → `'/api/habits/2/'`, the streaks entry to `{ habitId: 2, name: 'Run', current: 3, best: 9, yellowRun: runRun, yellowLimit: 2 }`, `const read = await screen.findByRole('article', { name: 'Read' })` → `const run = await screen.findByRole('article', { name: 'Run' })`, the first Minimum click to `within(run)`, and the final expectation to `toHaveTextContent('on Run')`.

1l. In "does not warn again when a yellow is re-saved on a habit already at the limit", replace

```ts
    const read = await screen.findByRole('article', { name: 'Read' })
    await within(read).findByText('2/2 yellows')
    await user.click(within(read).getByRole('button', { name: 'Minimum' }))
```

with (Read is a done row now, so re-save through the picker):

```ts
    const read = await screen.findByRole('article', { name: 'Read' })
    await user.click(within(read).getByRole('button', { name: 'Read' }))
    await user.click(screen.getByRole('button', { name: /^Minimum done/ }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `npx vitest run src/features/today/TodayPage.test.tsx`
Expected: FAIL (order `['Read', …]`, missing `Done` heading, `Min 1 page` text present, etc.).

- [ ] **Step 3: Rewrite `HabitCard.tsx`**

```tsx
import { Clock, Flame, NotebookPen } from 'lucide-react'
import { useId, useState } from 'react'
import { messageFor } from '../../api/errors'
import type { Color, WeekCell, WeekHabit } from '../../api/types'
import { cellClass, isColor, STATE_LABEL } from '../../lib/cells'
import { hapticMark } from '../../lib/haptics'
import { formatTimeLeft, isUrgent } from '../../lib/timeLeft'
import { card } from '../../lib/ui'
import { useSaveCheckIn } from '../stats/api'

/** Each choice wears its colour before it's pressed (dot + tinted edge) and fills with it once selected. */
const BUTTONS: { color: Color; label: string; idle: string; dot: string; selected: string }[] = [
  { color: 'GREEN', label: 'Target', idle: 'border-cell-green/30 bg-cell-green/[0.07]', dot: 'bg-cell-green',
    selected: 'border-cell-green bg-cell-green text-bg' },
  { color: 'YELLOW', label: 'Minimum', idle: 'border-cell-yellow/30 bg-cell-yellow/[0.07]', dot: 'bg-cell-yellow',
    selected: 'border-cell-yellow bg-cell-yellow text-bg' },
  { color: 'RED', label: 'Missed', idle: 'border-cell-red/30 bg-cell-red/[0.07]', dot: 'bg-cell-red',
    selected: 'border-cell-red bg-cell-red text-bg' },
]

type Tone = 'normal' | 'urgent' | 'done'

const TONE_CLASS: Record<Tone, string> = {
  normal: 'bg-surface text-muted',
  urgent: 'bg-urgent/15 text-urgent',
  done: 'bg-cell-green/15 text-cell-green',
}

const chipBase = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold'

function frequencyChip(habit: WeekHabit): string | null {
  if (habit.frequency === 'EVERY_N_DAYS') return `Every ${habit.intervalDays} days`
  if (habit.frequency === 'WEEKLY') return 'This week'
  return null
}

function NotePreview({ note, className = '' }: { note: string; className?: string }) {
  return (
    <p className={`flex items-center gap-1 text-[12px] text-muted ${className}`}>
      <NotebookPen size={12} className="flex-none" aria-hidden="true" />
      <span className="truncate">{note}</span>
    </p>
  )
}

interface HabitCardProps {
  habit: WeekHabit
  cell: WeekCell
  /** Current streak, once the streaks query has loaded. */
  streak: number | undefined
  now: Date
  /** N while this habit is at its yellow limit. */
  yellowLimit?: number
  onOpen(): void
}

/**
 * One habit on Today. Until it's green: a card with one-tap Target / Minimum / Missed. Green: a one-line row that
 * opens the picker. Both share the <article> root so the node (and this state) survives the switch.
 */
export function HabitCard({ habit, cell, streak, now, yellowLimit, onOpen }: HabitCardProps) {
  const saveCheckIn = useSaveCheckIn()
  const titleId = useId()
  const [error, setError] = useState<string | null>(null)
  const [popped, setPopped] = useState<Color | null>(null)
  const [missedJustNow, setMissedJustNow] = useState(false)
  const marked = isColor(cell.state)
  // At the limit, one more yellow restarts the streak (re-tapping today's own yellow changes nothing).
  const yellowResets = yellowLimit !== undefined && cell.state !== 'YELLOW'
  const timeLeft = cell.closesAt ? formatTimeLeft(cell.closesAt, now, habit.frequency) : null
  const tone: Tone = marked ? 'done' : cell.closesAt && isUrgent(cell.closesAt, now) ? 'urgent' : 'normal'
  const freq = frequencyChip(habit)

  async function mark(color: Color): Promise<void> {
    if (cell.state === color) return
    setError(null)
    hapticMark(color)
    try {
      await saveCheckIn.mutateAsync({ habitId: habit.id, periodStart: cell.periodStart ?? cell.date, color, note: cell.note })
      // A miss gets a quiet word instead of the celebratory pop.
      setPopped(color === 'RED' ? null : color)
      setMissedJustNow(color === 'RED')
    } catch (err) {
      setError(messageFor(err))
    }
  }

  const streakBadge = streak !== undefined && (
    <span className="flex flex-none items-center gap-1 font-display text-[15px] font-semibold text-fg">
      <Flame size={18} className={streak > 0 ? 'text-urgent' : 'text-dim'} aria-hidden="true" />
      <span className="sr-only">Current streak </span>
      {streak}
    </span>
  )
  const errorLine = error && <p role="alert" className="mt-2 text-sm text-cell-red">{error}</p>

  if (cell.state === 'GREEN') {
    return (
      <article aria-labelledby={titleId}
        className="relative flex items-center gap-3 rounded-[18px] border border-line bg-card px-4 py-3">
        <span aria-hidden="true" data-pop={popped === 'GREEN' ? '' : undefined} onAnimationEnd={() => setPopped(null)}
          className={`h-[22px] w-[22px] flex-none rounded-[7px] data-pop:animate-pop ${cellClass(cell.state)}`} />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-[15px] font-semibold break-words text-fg">
            {/* The ::after stretches the tap target over the whole row. */}
            <button type="button" aria-haspopup="dialog" onClick={onOpen}
              className="text-left after:absolute after:inset-0 after:rounded-[18px]">
              {habit.name}
            </button>
          </h2>
          <p className="sr-only">{STATE_LABEL[cell.state]}</p>
          {cell.note && <NotePreview note={cell.note} />}
          {errorLine}
        </div>
        {streakBadge}
      </article>
    )
  }

  return (
    <article aria-labelledby={titleId} className={card}>
      <div className="flex items-start justify-between gap-3">
        <h2 id={titleId} className="min-w-0 text-[18px] font-semibold break-words text-fg">
          <button type="button" aria-haspopup="dialog" onClick={onOpen} className="text-left hover:underline">
            {habit.name}
          </button>
        </h2>
        {streakBadge}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {BUTTONS.map(({ color, label, idle, dot, selected }) => {
          const pressed = cell.state === color
          const warn = color === 'YELLOW' && yellowResets
          return (
            <button key={color} type="button" aria-pressed={pressed} disabled={saveCheckIn.isPending}
              aria-describedby={warn ? `${titleId}-reset` : undefined}
              onClick={() => void mark(color)}
              onAnimationEnd={() => setPopped(null)}
              data-pop={popped === color ? '' : undefined}
              className={`flex min-h-12 flex-col items-center justify-center rounded-[14px] border px-1 py-2 text-[14px] font-semibold transition-[transform,background-color,border-color] active:scale-[0.97] disabled:opacity-60 data-pop:animate-pop ${
                pressed ? selected : `${idle} text-fg`
              }`}>
              <span className="flex items-center gap-1.5">
                {!pressed && <span className={`h-2 w-2 flex-none rounded-full ${dot}`} aria-hidden="true" />}
                {label}
              </span>
              {warn && <span className="text-[11px] leading-tight font-medium text-cell-yellow" aria-hidden="true">restarts streak</span>}
            </button>
          )
        })}
      </div>
      {yellowResets && (
        <p id={`${titleId}-reset`} className="sr-only">You've used {yellowLimit} yellows in a row; another restarts the streak.</p>
      )}
      {missedJustNow && cell.state === 'RED' && (
        <p role="status" className="mt-3 text-[14px] text-muted">
          That's honest. {habit.frequency === 'DAILY' ? 'Tomorrow' : 'The next one'} is a fresh start.
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="flex flex-wrap items-center gap-1.5">
          {timeLeft && (
            <span data-tone={tone} className={`${chipBase} ${TONE_CLASS[tone]}`}>
              <Clock size={13} aria-hidden="true" />
              {timeLeft}
            </span>
          )}
          {freq && <span className={`${chipBase} bg-surface text-muted`}>{freq}</span>}
          {yellowLimit !== undefined && (
            <span className={`${chipBase} bg-cell-yellow/15 text-cell-yellow`}>{yellowLimit}/{yellowLimit} yellows</span>
          )}
        </span>
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
      {marked && cell.note && <NotePreview note={cell.note} className="mt-3" />}
      {errorLine}
    </article>
  )
}

export default HabitCard
```

- [ ] **Step 4: Order cards and insert the `Done` heading in `TodayPage.tsx`**

After `const summary = …`, add:

```tsx
  const isDone = (item: TodayItem) => item.cell.state === 'GREEN'
  const ordered = [...items.filter((item) => !isDone(item)), ...items.filter(isDone)]
  const firstDone = ordered.findIndex(isDone)
```

Replace the `<div className="grid grid-cols-1 gap-3 xl:grid-cols-2">…</div>` block with:

```tsx
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {/* One flat keyed list, so a card that moves into Done keeps its state. */}
              {ordered.flatMap((item, i) => {
                const s = streakFor(item.habit.id)
                const habitCard = (
                  <HabitCard key={item.habit.id} habit={item.habit} cell={item.cell} streak={s?.current}
                    yellowLimit={atYellowLimit(s) ? s.yellowLimit : undefined} now={now} onOpen={() => setPicked(item)} />
                )
                return i === firstDone
                  ? [<h2 key="done" className="col-span-full mt-2 px-1 text-[12px] font-semibold tracking-[0.06em] text-muted uppercase">Done</h2>, habitCard]
                  : [habitCard]
              })}
            </div>
```

(`card` is already imported from `lib/ui` in this file, hence `habitCard`.)

- [ ] **Step 5: Run tests, confirm they pass**

Run: `npx vitest run src/features/today`
Expected: PASS.

- [ ] **Step 6: Update the e2e test** — in `web/e2e/habit.spec.ts` replace lines 24–26 (the Target click, the `aria-pressed` expectation and the `data-tone done` expectation) with:

```ts
  await card.getByRole('button', { name: 'Target', exact: true }).click()
  await expect(card.getByRole('button', { name: 'Target', exact: true })).toHaveCount(0)
  await expect(card).toContainText('Target hit')
```

- [ ] **Step 7: Full validation**

Run: `npx vitest run && npm run lint && npm run build`
Expected: all pass; only the 2 known lint warnings.

- [ ] **Step 8: Commit**

```bash
git add web/src/features/today web/e2e/habit.spec.ts
git commit -m "feat(web): compact Today cards; green habits collapse into a Done list

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Progress week in one card

**Files:**
- Modify: `web/src/features/progress/WeekTiles.tsx`
- Modify: `web/src/features/progress/WeekPanel.test.tsx` (test "shows the grid, distribution and streaks", ~line 62)

**Interfaces:** `WeekTiles` props unchanged.

- [ ] **Step 1: Write the failing assertions** — append inside "shows the grid, distribution and streaks", after the existing `closest('li')` expectation:

```ts
    const list = screen.getByRole('heading', { level: 3, name: 'Read' }).closest('ul')!
    const weekCard = list.parentElement!
    expect(weekCard).toHaveClass('rounded-card')
    expect(list.querySelector('.rounded-card')).toBeNull()
    expect(weekCard.firstElementChild).toHaveAttribute('aria-hidden', 'true')
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx vitest run src/features/progress/WeekPanel.test.tsx`
Expected: FAIL (`weekCard` lacks `rounded-card`).

- [ ] **Step 3: Implement** — in `WeekTiles.tsx`:

- Replace `const tile = 'rounded-card border border-line bg-card px-4 py-3'` with
  `const weekCard = 'rounded-card border border-line bg-card px-4 py-3'`.
- Change the outer `<div className="flex flex-col gap-3">` to `<div className={weekCard}>`.
- Header: change its className to `` `${days} border-b border-line pb-2 text-center` `` and update the comment to:
  `{/* Every cell's label already names its day, so the header is visual only. It shares the card's padding, so columns line up. */}`
- `<ul className="flex flex-col gap-3">` → `<ul>`.
- `<li … className={tile}>` → `<li … className="border-t border-line py-2.5 first:border-t-0">`.
- Doc comment: `/** Progress week: one card with a Mon–Sun header, then a row per habit, its name above a thin strip of day pills. */`

- [ ] **Step 4: Run, confirm pass**

Run: `npx vitest run src/features/progress`
Expected: PASS.

- [ ] **Step 5: Full validation** — `npx vitest run && npm run lint && npm run build`.

- [ ] **Step 6: Commit**

```bash
git add web/src/features/progress/WeekTiles.tsx web/src/features/progress/WeekPanel.test.tsx
git commit -m "feat(web): draw the Progress week's habits inside one card

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
