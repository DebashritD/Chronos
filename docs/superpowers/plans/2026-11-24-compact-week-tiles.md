# Compact Week Tiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On Progress → Week, shrink each habit tile to about half its height by drawing its days as a thin strip of 8px pills instead of 40px squares.

**Architecture:** `WeekCellButton` gains an opt-in `pill` prop that draws the state colour on an inner 8px pill inside a 28px transparent button. `WeekTiles` uses it, tightens the tile padding, and puts the frequency label inline after the name. `WeekGrid` on Today doesn't pass `pill`, so it is unchanged.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Vitest + Testing Library.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-11-24-compact-week-tiles-design.md`.
- Same layout at every screen width. Month view, the Today cards and the Today `WeekGrid` are unchanged.
- There is no ring on today's pill. The shared weekday and date header is unchanged.
- Cell buttons keep their `aria-label`, `aria-current="date"`, `disabled` and dimming rules exactly.
- Copy rules: curly apostrophes, no exclamation marks.
- Validate from `web/` with `npx vitest run && npm run lint && npm run build`. Lint has 2 expected `only-export-components` warnings; add no new ones.
- Commits end with `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`. Never add `PRODUCT.md`.

---

### Task 1: Pill strip in week tiles

**Files:**
- Modify: `web/src/features/progress/WeekCellButton.tsx`
- Modify: `web/src/features/progress/WeekTiles.tsx`
- Test: `web/src/features/progress/WeekPanel.test.tsx`

**Interfaces:**
- Produces: `WeekCellButton` props gain `pill?: boolean` (default `false`). When it is true, the inner pill is `<span aria-hidden="true" data-pill="">` carrying `cellClass(state)`.

- [ ] **Step 1: Write the failing test.** Add it to `WeekPanel.test.tsx` after the "marks today's cells" test:

```tsx
  it('draws each day as a thin pill inside a tappable cell', async () => {
    api()
    renderWithProviders(<WeekPanel />, { route: '/progress' })

    const cell = await screen.findByRole('button', { name: 'Read, Mon 16 Nov, Target hit' })
    expect(cell).toHaveClass('h-7')
    expect(cell).not.toHaveClass('bg-cell-green')
    expect(cell.querySelector('[data-pill]')).toHaveClass('h-2', 'rounded-full', 'bg-cell-green')
    expect(screen.getByRole('button', { name: /^Piano/ }).querySelector('[data-pill]')).toHaveClass('border-outline')
  })
```

- [ ] **Step 2: Run the test and confirm it fails.**

Run: `cd web && npx vitest run src/features/progress/WeekPanel.test.tsx`
Expected: the new test FAILS, because the button has `h-10` and no `[data-pill]` child. The other tests pass.

- [ ] **Step 3: Implement `pill` in `WeekCellButton.tsx`.** Replace the whole file with:

```tsx
import type { WeekCell, WeekHabit } from '../../api/types'
import { cellClass, STATE_LABEL } from '../../lib/cells'
import { periodLabel } from '../checkin/period'

interface WeekCellButtonProps {
  habit: WeekHabit
  cell: WeekCell
  isToday: boolean
  /** Size classes, e.g. 'aspect-square' or a fixed height. */
  shape: string
  /** Draw the state as a thin pill centred in a transparent button instead of filling it. */
  pill?: boolean
  onPick(habit: WeekHabit, cell: WeekCell): void
}

/** One tappable period cell; past uneditable ones are dimmed. Today is marked in the day strip, not on each cell. */
export function WeekCellButton({ habit, cell, isToday, shape, pill = false, onPick }: WeekCellButtonProps) {
  const fill = cellClass(cell.state)
  return (
    <button
      type="button"
      aria-label={`${habit.name}, ${periodLabel(habit, cell)}, ${STATE_LABEL[cell.state]}`}
      aria-current={isToday ? 'date' : undefined}
      disabled={!cell.editable}
      onClick={() => onPick(habit, cell)}
      className={`block w-full ${shape} ${pill ? 'flex items-center' : `rounded-cell ${fill}`} ${cell.editable ? 'cursor-pointer transition-transform active:scale-95' : cell.state === 'NOT_DUE' ? '' : 'opacity-50'}`}
    >
      {pill && <span aria-hidden="true" data-pill="" className={`block h-2 w-full rounded-full ${fill}`} />}
    </button>
  )
}

export default WeekCellButton
```

- [ ] **Step 4: Use it in `WeekTiles.tsx`.**
  - Change the constants to:

```tsx
const tile = 'rounded-card border border-line bg-card px-4 py-3'
const days = 'grid grid-cols-7 gap-1.5'
const cellHeight = 'h-7'
```

  - Replace the `<li>` body (from `<div className="mb-3 flex items-start justify-between gap-3">` through the closing `</div>` of the `days` grid) with:

```tsx
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0 break-words">
                  <h3 className="inline text-[16px] leading-snug font-semibold text-fg">{habit.name}</h3>
                  {sub && <span className="ml-1.5 text-[12px] text-dim">{sub}</span>}
                </div>
                {streak !== undefined && streak > 0 && (
                  <span className="flex flex-none items-center gap-1 font-display text-[14px] font-semibold text-fg">
                    <Flame size={16} className="text-urgent" aria-hidden="true" />
                    <span className="sr-only">Current streak </span>
                    {streak}
                  </span>
                )}
              </div>
              <div className={`${days} mt-2`}>
                {weekSegments(habit, start).map(({ col, span, cell, from, to }) => (
                  <div key={col} style={{ gridColumn: `${col + 1} / span ${span}` }}>
                    {cell ? (
                      <WeekCellButton habit={habit} cell={cell} isToday={from <= today && today <= to} onPick={onPick}
                        shape={cellHeight} pill />
                    ) : (
                      <span aria-hidden="true" className={`flex items-center ${cellHeight}`}>
                        <span className={`block h-2 w-full rounded-full ${cellClass('NOT_DUE')}`} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
```

  - Update the component doc comment to: `/** Progress week: a shared Mon–Sun header, then one compact tile per habit, with its name above a thin strip of day pills. */`

- [ ] **Step 5: Run the tests and confirm they pass.**

Run: `cd web && npx vitest run src/features/progress src/features/today`
Expected: all tests PASS. The Today tests cover `WeekGrid`, which is unchanged.

- [ ] **Step 6: Run the full validation.**

Run: `cd web && npx vitest run && npm run lint && npm run build`
Expected: all tests pass, lint shows only the 2 known warnings, and the build succeeds.

- [ ] **Step 7: Commit.**

```bash
git add web/src/features/progress/WeekCellButton.tsx web/src/features/progress/WeekTiles.tsx web/src/features/progress/WeekPanel.test.tsx
git commit -m "feat(web): compact week tiles with a thin pill strip

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
