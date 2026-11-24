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
