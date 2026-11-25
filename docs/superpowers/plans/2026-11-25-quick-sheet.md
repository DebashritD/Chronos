# Quick Check-in Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the check-in sheet one-tap: tapping a choice saves and closes, the note hides behind "+ Add note", a context row shows streak / time left / this week, and the selected choice is tinted in its colour.

**Architecture:** First extract the Today card's streak badge, time-left chip and week pills into a shared module (no behaviour change). Then rework `CellPicker` to use them and to save on tap; its two callers pass `streak` and `now`.

**Tech Stack:** React 19, TypeScript, Tailwind v4, TanStack Query v5, Vitest + Testing Library. Run everything from `web/`.

Spec: `docs/superpowers/specs/2026-11-25-quick-sheet-design.md`.

## Global Constraints

- Validation from `web/`: `npx vitest run && npm run lint && npm run build`. Lint has exactly 2 pre-existing `react-refresh/only-export-components` warnings; add no new warnings.
- Never `git add` `PRODUCT.md` (untracked at repo root). Stage only the files each task names.
- Commits end with the trailer `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.
- Selected choice: `border-cell-green bg-cell-green/15` / `border-cell-yellow bg-cell-yellow/15` / `border-cell-red bg-cell-red/15`; unselected `border-line bg-surface`.
- Ringed day pill: `ring-2 ring-fg ring-offset-1 ring-offset-card`.
- Note field label stays exactly `Note (optional)`, `rows={2}`, `maxLength={500}`. The reveal button text is exactly `+ Add note`. The note-only save button text is exactly `Save note`.
- Week pills show for DAILY habits only.

---

### Task 1: Shared habit bits (refactor, no behaviour change)

**Files:**
- Create: `web/src/features/today/habitBits.tsx`
- Modify: `web/src/lib/ui.ts` (add `chip`)
- Modify: `web/src/features/today/HabitCard.tsx`
- Test: existing `web/src/features/today/TodayPage.test.tsx` (must pass unchanged)

**Interfaces:**
- Produces (used by Task 2):
  - `chip: string` in `web/src/lib/ui.ts`
  - `StreakBadge({ streak }: { streak: number })`
  - `TimeLeftChip({ habit, cell, now }: { habit: WeekHabit; cell: WeekCell; now: Date })` — renders `null` when there is no time left; root has `data-tone` = `normal | urgent | done`.
  - `WeekPills({ cells, ring, className }: { cells: WeekCell[]; ring?: string; className?: string })` — `aria-hidden` row of pills; the pill whose `date === ring` gets `data-ring=""` and the ring classes.

- [ ] **Step 1: Add the shared chip class** to `web/src/lib/ui.ts` (after `card`):

```ts
export const chip = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold'
```

- [ ] **Step 2: Create `web/src/features/today/habitBits.tsx`:**

```tsx
import { Clock, Flame } from 'lucide-react'
import type { WeekCell, WeekHabit } from '../../api/types'
import { cellClass, isColor } from '../../lib/cells'
import { formatTimeLeft, isUrgent } from '../../lib/timeLeft'
import { chip } from '../../lib/ui'

type Tone = 'normal' | 'urgent' | 'done'

const TONE_CLASS: Record<Tone, string> = {
  normal: 'bg-surface text-muted',
  urgent: 'bg-urgent/15 text-urgent',
  done: 'bg-cell-green/15 text-cell-green',
}

export function StreakBadge({ streak }: { streak: number }) {
  return (
    <span className="flex flex-none items-center gap-1 font-display text-[15px] font-semibold text-fg">
      <Flame size={18} className={streak > 0 ? 'text-urgent' : 'text-dim'} aria-hidden="true" />
      <span className="sr-only">Current streak </span>
      {streak}
    </span>
  )
}

/** Countdown to the end of the cell's period; nothing once it has closed. */
export function TimeLeftChip({ habit, cell, now }: { habit: WeekHabit; cell: WeekCell; now: Date }) {
  const text = cell.closesAt ? formatTimeLeft(cell.closesAt, now, habit.frequency) : null
  if (!text) return null
  const tone: Tone = isColor(cell.state) ? 'done' : cell.closesAt && isUrgent(cell.closesAt, now) ? 'urgent' : 'normal'
  return (
    <span data-tone={tone} className={`${chip} ${TONE_CLASS[tone]}`}>
      <Clock size={13} aria-hidden="true" />
      {text}
    </span>
  )
}

/** The week's days as short pills; `ring` (a date) rings one of them. */
export function WeekPills({ cells, ring, className = '' }: { cells: WeekCell[]; ring?: string; className?: string }) {
  return (
    <span className={`flex gap-1 ${className}`} aria-hidden="true">
      {cells.map((c) => (
        <span key={c.date} data-ring={c.date === ring ? '' : undefined} className={`h-1.5 w-4 rounded-full ${
          c.state === 'PENDING' || c.state === 'NOT_DUE' ? 'bg-surface' : cellClass(c.state)
        }${c.date === ring ? ' ring-2 ring-fg ring-offset-1 ring-offset-card' : ''}`} />
      ))}
    </span>
  )
}
```

- [ ] **Step 3: Use them in `HabitCard.tsx`.**
  - Delete the local `Tone` type, `TONE_CLASS`, `chipBase`, and the `timeLeft` / `tone` constants inside the component.
  - Imports: drop `Clock`, `Flame` from `lucide-react` (keep `NotebookPen`); drop `formatTimeLeft, isUrgent`; import `{ card, chip } from '../../lib/ui'` and `{ StreakBadge, TimeLeftChip, WeekPills } from './habitBits'`.
  - Replace the `streakBadge` constant with:

```tsx
  const streakBadge = streak !== undefined && <StreakBadge streak={streak} />
```

  - In the footer, replace the time-left `<span data-tone=…>…</span>` block with `<TimeLeftChip habit={habit} cell={cell} now={now} />`, change the two `${chipBase} …` class strings to `${chip} …`, and replace the DAILY pill `<span className="flex gap-1 md:hidden" …>…</span>` block with:

```tsx
        {habit.frequency === 'DAILY' && <WeekPills cells={habit.cells} className="md:hidden" />}
```

- [ ] **Step 4: Verify no behaviour change.** Run `npx vitest run src/features/today && npm run lint && npm run build`. Expected: all pass, lint shows only the 2 pre-existing warnings.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/ui.ts web/src/features/today/habitBits.tsx web/src/features/today/HabitCard.tsx
git commit -m "refactor(web): share the streak badge, time-left chip and week pills

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: One-tap sheet with context row and tinted choices

**Files:**
- Modify: `web/src/features/checkin/CellPicker.tsx`
- Modify: `web/src/features/today/TodayPage.tsx` (pass `streak`, `now`)
- Modify: `web/src/features/progress/WeekPanel.tsx` (pass `streak`, `now`)
- Test: `web/src/features/progress/WeekPanel.test.tsx`, `web/src/features/today/TodayPage.test.tsx`

**Interfaces:**
- Consumes: `chip` is not needed here; uses `StreakBadge`, `TimeLeftChip`, `WeekPills` from `web/src/features/today/habitBits.tsx` (Task 1).
- Produces: `CellPicker` props become `{ habit: WeekHabit; cell: WeekCell; streak?: number; now: Date; onClose(): void }`.

- [ ] **Step 1: Update the WeekPanel tests (they fail first).** In `web/src/features/progress/WeekPanel.test.tsx`:

Replace the test `'saves a color with a note'` with:

```tsx
  it('saves on a single tap, with a note added first', async () => {
    const fetchMock = api((r) => (r.method === 'PUT' ? jsonResponse({ periodStart: '2026-11-18', color: 'GREEN', note: 'ch 4' }) : undefined))
    const { user } = renderWithProviders(<WeekPanel />, { route: '/progress' })

    await user.click(await screen.findByRole('button', { name: 'Read, Wed 18 Nov, Not marked yet' }))
    const dialog = screen.getByRole('dialog', { name: 'Read, Wed 18 Nov' })
    expect(within(dialog).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Note (optional)')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /^Target hit/ })).toHaveTextContent('20 pages')
    expect(within(dialog).getByRole('button', { name: /^Minimum done/ })).toHaveTextContent('1 page')
    expect(within(dialog).getByRole('button', { name: /^Missed/ })).toHaveTextContent("Didn't do it")
    await user.click(within(dialog).getByRole('button', { name: '+ Add note' }))
    const note = within(dialog).getByLabelText('Note (optional)')
    expect(note).toHaveFocus()
    expect(within(dialog).queryByRole('button', { name: '+ Add note' })).not.toBeInTheDocument()
    await user.type(note, 'ch 4')
    await user.click(within(dialog).getByRole('button', { name: /^Target hit/ }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(requests(fetchMock).find((r) => r.method === 'PUT')).toEqual({
      method: 'PUT',
      url: '/api/habits/1/check-ins/2026-11-18',
      body: { color: 'GREEN', note: 'ch 4' },
    })
    expect(requests(fetchMock).filter((r) => r.url.startsWith('/api/stats/week')).length).toBeGreaterThan(1)
  })
```

In `'opens with the current color and note, and clears'`, after the `toHaveValue('great')` line add:

```tsx
    expect(within(dialog).queryByRole('button', { name: '+ Add note' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Save note' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /^Target hit/ })).toHaveClass('border-cell-green', 'bg-cell-green/15')
    expect(within(dialog).getByRole('button', { name: /^Missed/ })).toHaveClass('border-line', 'bg-surface')
```

Add a new test after it:

```tsx
  it('saves only the note of a marked day with Save note', async () => {
    const fetchMock = api((r) => (r.method === 'PUT' ? jsonResponse({ periodStart: '2026-11-16', color: 'GREEN', note: 'great run' }) : undefined))
    const { user } = renderWithProviders(<WeekPanel />, { route: '/progress' })

    await user.click(await screen.findByRole('button', { name: 'Read, Mon 16 Nov, Target hit' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Note (optional)'), ' run')
    await user.click(within(dialog).getByRole('button', { name: 'Save note' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(requests(fetchMock).find((r) => r.method === 'PUT')).toEqual({
      method: 'PUT',
      url: '/api/habits/1/check-ins/2026-11-16',
      body: { color: 'GREEN', note: 'great run' },
    })
  })

  it('shows the streak and rings the opened day, without a countdown for a past day', async () => {
    api()
    const { user } = renderWithProviders(<WeekPanel />, { route: '/progress' })

    await user.click(await screen.findByRole('button', { name: 'Read, Mon 16 Nov, Target hit' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Current streak 0')
    expect(dialog.querySelector('[data-tone]')).toBeNull()
    expect(dialog.querySelectorAll('[data-ring]')).toHaveLength(1)
  })
```

Replace `'has no Clear for unmarked periods and closes on Cancel'` with:

```tsx
  it('has no Clear or pills for an unmarked weekly period and closes on a backdrop tap', async () => {
    api()
    const { user } = renderWithProviders(<WeekPanel />, { route: '/progress' })

    await user.click(await screen.findByRole('button', { name: /^Piano/ }))
    const dialog = screen.getByRole('dialog', { name: 'Piano, week of Mon 16 Nov' })
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    expect(dialog.querySelector('[data-ring]')).toBeNull()
    await user.click(dialog.parentElement!)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
```

In `'closes the picker at once and reports a rejected save in a toast'` and `'warns when a yellow saved from the grid uses up the limit'`, delete the line `await user.click(screen.getByRole('button', { name: 'Save' }))`.

- [ ] **Step 2: Update the TodayPage tests.** In `web/src/features/today/TodayPage.test.tsx`:

In `'does not warn again when a yellow is re-saved on a habit already at the limit'`, delete the line `await user.click(screen.getByRole('button', { name: 'Save' }))`.

Add after `'opens the picker from a done row to edit its note'`:

```tsx
  it('shows the streak and time left in the picker', async () => {
    api()
    const { user } = renderWithProviders(<TodayPage />)

    const read = await screen.findByRole('article', { name: 'Read' })
    await waitFor(() => expect(read).toHaveTextContent('Current streak 12'))
    await user.click(within(read).getByRole('button', { name: 'Read' }))

    const dialog = screen.getByRole('dialog', { name: 'Read, Wed 18 Nov' })
    expect(dialog).toHaveTextContent('Current streak 12')
    expect(chip(dialog)).toHaveTextContent('12h left today')
    expect(chip(dialog)).toHaveAttribute('data-tone', 'done')
    expect(dialog.querySelectorAll('[data-ring]')).toHaveLength(1)
  })
```

- [ ] **Step 3: Run the tests to see them fail.** `npx vitest run src/features/progress/WeekPanel.test.tsx src/features/today/TodayPage.test.tsx`. Expected: the new/changed tests FAIL (no `+ Add note`, Save still required, no context row).

- [ ] **Step 4: Rewrite `web/src/features/checkin/CellPicker.tsx`:**

```tsx
import { useRef, useState } from 'react'
import { messageFor } from '../../api/errors'
import type { Color, WeekCell, WeekHabit } from '../../api/types'
import { cellClass, isColor, STATE_LABEL } from '../../lib/cells'
import { hapticMark } from '../../lib/haptics'
import { inputClass, primaryButton } from '../../lib/ui'
import { MOBILE_QUERY, REDUCED_MOTION_QUERY, useMediaQuery } from '../../lib/useMediaQuery'
import { useClearCheckIn, useSaveCheckIn } from '../stats/api'
import { StreakBadge, TimeLeftChip, WeekPills } from '../today/habitBits'
import { periodLabel } from './period'
import { useSheetDrag } from './useSheetDrag'

/** Each choice is tinted in its own colour once it is the saved one. */
const CHOICES: { color: Color; hint(habit: WeekHabit): string; selected: string }[] = [
  { color: 'GREEN', hint: (habit) => habit.targetText, selected: 'border-cell-green bg-cell-green/15' },
  { color: 'YELLOW', hint: (habit) => habit.minText, selected: 'border-cell-yellow bg-cell-yellow/15' },
  { color: 'RED', hint: () => "Didn't do it", selected: 'border-cell-red bg-cell-red/15' },
]

interface CellPickerProps {
  habit: WeekHabit
  cell: WeekCell
  /** Current streak, once the streaks query has loaded. */
  streak?: number
  now: Date
  onClose(): void
}

/**
 * Bottom sheet on phones, centred dialog on wider screens. Tapping a choice saves it (with any note) and closes;
 * "Save note" saves a changed note on an already-marked period; Clear removes the check-in.
 */
export function CellPicker({ habit, cell, streak, now, onClose }: CellPickerProps) {
  const saveCheckIn = useSaveCheckIn()
  const clearCheckIn = useClearCheckIn()
  const saved = isColor(cell.state) ? cell.state : null
  const [note, setNote] = useState(cell.note ?? '')
  const [noteOpen, setNoteOpen] = useState(Boolean(cell.note))
  const [error, setError] = useState<string | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const mobile = useMediaQuery(MOBILE_QUERY)
  const reduced = useMediaQuery(REDUCED_MOTION_QUERY)
  useSheetDrag(sheetRef, { enabled: mobile, reduced, onClose })
  const busy = saveCheckIn.isPending || clearCheckIn.isPending
  const key = { habitId: habit.id, periodStart: cell.periodStart ?? cell.date }
  const noteChanged = note.trim() !== (cell.note ?? '')

  async function run(action: () => Promise<unknown>): Promise<void> {
    setError(null)
    try {
      await action()
      onClose()
    } catch (err) {
      setError(messageFor(err))
    }
  }

  function save(color: Color): void {
    hapticMark(color)
    void run(() => saveCheckIn.mutateAsync({ ...key, color, note: note.trim() || null }))
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}>
      <div ref={sheetRef} role="dialog" aria-modal="true" aria-label={`${habit.name}, ${periodLabel(habit, cell)}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
        }}
        className="w-full rounded-t-[28px] border border-line bg-card px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:max-w-md md:rounded-[28px] md:pt-6">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline md:hidden" aria-hidden="true" />
        <h2 className="text-[22px] font-semibold text-fg">{habit.name}</h2>
        <p className="mt-0.5 text-[14px] text-muted">{periodLabel(habit, cell)}</p>
        <div className="mt-3 mb-4 flex min-h-6 items-center gap-2">
          {streak !== undefined && <StreakBadge streak={streak} />}
          <TimeLeftChip habit={habit} cell={cell} now={now} />
          {habit.frequency === 'DAILY' && <WeekPills cells={habit.cells} ring={cell.date} className="ml-auto" />}
        </div>
        <div className="flex flex-col gap-2">
          {CHOICES.map((choice) => (
            <button key={choice.color} type="button" aria-pressed={saved === choice.color} disabled={busy}
              onClick={() => save(choice.color)}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left disabled:opacity-60 ${
                saved === choice.color ? choice.selected : 'border-line bg-surface'
              }`}>
              <span className={`h-6 w-6 flex-none rounded-lg ${cellClass(choice.color)}`} aria-hidden="true" />
              <span className="text-[15px] font-semibold text-fg">
                {STATE_LABEL[choice.color]}
                <small className="block text-[13px] font-normal text-muted">{choice.hint(habit)}</small>
              </span>
            </button>
          ))}
        </div>
        {noteOpen ? (
          <>
            <label htmlFor="check-in-note" className="mt-4 mb-1.5 block text-[13px] font-medium text-muted">
              Note (optional)
            </label>
            {/* Focus only when opened by "+ Add note"; an existing note shouldn't pop the keyboard. */}
            <textarea id="check-in-note" rows={2} maxLength={500} value={note} autoFocus={!cell.note}
              onChange={(e) => setNote(e.target.value)} className={inputClass} />
          </>
        ) : (
          <button type="button" onClick={() => setNoteOpen(true)}
            className="mt-4 text-[14px] font-semibold text-accent">+ Add note</button>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-cell-red">{error}</p>}
        {saved && (
          <div className="mt-5 flex items-center gap-2">
            <button type="button" disabled={busy}
              className="rounded-[14px] border border-line bg-surface px-4 py-3 text-[15px] font-medium text-cell-red disabled:opacity-50"
              onClick={() => void run(() => clearCheckIn.mutateAsync(key))}>Clear</button>
            {noteChanged && (
              <button type="button" disabled={busy} className={`${primaryButton} ml-auto`}
                onClick={() => void run(() => saveCheckIn.mutateAsync({ ...key, color: saved, note: note.trim() || null }))}>
                Save note
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CellPicker
```

- [ ] **Step 5: Pass `streak` and `now` from the callers.**

`web/src/features/today/TodayPage.tsx` — change the picker line to:

```tsx
      {picked && <CellPicker habit={picked.habit} cell={picked.cell} streak={streakFor(picked.habit.id)?.current}
        now={now} onClose={() => setPicked(null)} />}
```

`web/src/features/progress/WeekPanel.tsx` — add `import { useNow } from '../../lib/useNow'`, add `const now = useNow()` right after `const streaks = useStreaks()` (before any early return), and change the picker line to:

```tsx
      {picked && <CellPicker habit={picked.habit} cell={picked.cell}
        streak={streaks.data?.find((streak) => streak.habitId === picked.habit.id)?.current}
        now={now} onClose={() => setPicked(null)} />}
```

- [ ] **Step 6: Run the tests.** `npx vitest run src/features/progress/WeekPanel.test.tsx src/features/today/TodayPage.test.tsx`. Expected: PASS. Then the full validation: `npx vitest run && npm run lint && npm run build`. If the dev server at `http://localhost:5174` is up, also run `E2E_BASE_URL=http://localhost:5174 npx playwright test` (do not use ports 5173 or 8080).

- [ ] **Step 7: Commit**

```bash
git add web/src/features/checkin/CellPicker.tsx web/src/features/today/TodayPage.tsx web/src/features/progress/WeekPanel.tsx web/src/features/progress/WeekPanel.test.tsx web/src/features/today/TodayPage.test.tsx
git commit -m "feat(web): one-tap check-in sheet with streak, time left and week

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
