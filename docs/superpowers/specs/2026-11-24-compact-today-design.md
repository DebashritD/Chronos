# Compact Today — design

## Problem
Today's habit cards are tall: a Min/Target line under every name, a footer row, and (once marked) a note row.
About 2½ habits fit on a phone screen.

## Decisions (approved, mockup option B)
1. **Min/Target line removed** from every Today card. Min/Target stay visible in the check-in sheet (`CellPicker` hints).
2. **Frequency kept as a chip.** `EVERY_N_DAYS` → chip `Every N days`; `WEEKLY` → chip `This week`; `DAILY` → no chip.
   It sits in the footer chip row after the time-left chip (and before the yellow-limit chip).
3. **Marked habits collapse to one row**, listed after all unmarked cards under a `Done` heading.
   - Row content: colour block (`cellClass(state)`, `h-[22px] w-[22px] rounded-[7px]`), habit name, optional one-line
     preview (truncated), streak (flame + number) on the right.
   - Preview line: `That's honest. Tomorrow is a fresh start.` (or `The next one…` for non-daily) right after marking
     Missed on this card; otherwise the saved note; otherwise nothing.
   - The whole row is a button that calls `onOpen()` (opens `CellPicker`). Accessible name: the habit name.
   - No time-left chip, yellow-limit chip, week strip, mark buttons or note editor on the row.
4. **Note UI leaves the card.** The "Add a note"/"Edit note" button and inline note form are removed; notes are added
   and edited in `CellPicker` (already supported).
5. **Order:** unmarked first, then marked, each keeping `todayItems` order. The `Done` heading appears only when at
   least one habit is marked and spans all grid columns (`col-span-full`).
6. **State survives the move:** cards and the heading render as keyed siblings of one grid so a card that moves into
   Done keeps its React state (the "That's honest" flag). The pop animation plays on the collapsed row's colour block.
7. Same layout on mobile and desktop.

## Out of scope
Progress page, `CellPicker` changes, the desktop `WeekGrid` aside, `TodaySummary`.

## Testing
Update `TodayPage.test.tsx`:
- Meta assertions: no `Min …`/`Target …` text on cards; `Every 3 days` / `This week` chips present; none for daily.
- Marked habit renders as a row (no Target/Minimum/Missed buttons), after unmarked ones, under `Done`; row shows note
  preview; clicking it opens the picker dialog.
- Marking an unmarked habit moves it into Done and shows the "That's honest" preview after Missed.
- Remove/replace the inline note-editing tests (notes are now covered via the picker test).

---

# Part 2 — Progress week in one card (mockup option B)

## Problem
Progress → Week draws one bordered tile per habit with gaps between them, wasting vertical space.

## Decisions
1. All habits sit inside **one card** (`rounded-card border border-line bg-card px-4 py-3`), mobile and desktop alike.
2. The Mon–Sun day header moves **inside** that card, at its top, so its columns align with the strips with no
   border-offset padding. A divider (`border-b border-line`) separates it from the first habit, with `pb-2`.
3. Each habit is a row inside the card: unchanged content (name + subtitle inline, streak right, pill strip below),
   with `py-2.5` and a `border-t border-line` divider between rows (none above the first row).
4. Rows stay `<li aria-label={habit.name}>` with the `h3` name, so the name ↔ strip association is the same as now
   (each cell button's accessible name already starts with the habit name).
5. Month view, `WeekGrid` (Today desktop) and `WeekCellButton` are unchanged.

## Testing
`WeekPanel.test.tsx`: the list's items share one card container (no per-item card class); the header sits inside the
same card as the list. Existing tests on names, streaks, pills and picking keep passing.
