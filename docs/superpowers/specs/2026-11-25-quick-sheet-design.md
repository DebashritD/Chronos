# Quick check-in sheet — design

The check-in sheet (`web/src/features/checkin/CellPicker.tsx`) opens from a Today row/card name and from a Progress
day cell. Today it takes two taps (choice, then Save), always shows the note box, and shows no context about the habit.
Mockup: `/tmp/sheet-mock.png` (approved 2026-11-25).

## 1. Tap a choice to save

- Tapping Target hit / Minimum done / Missed saves immediately — colour plus the current note text (trimmed, empty →
  `null`) — then closes the sheet. It calls `hapticMark(color)` like the Today buttons.
- Tapping the choice that is already selected saves too (same request; harmless, and saves any note change).
- The **Save** and **Cancel** buttons are removed. The sheet still closes by swipe-down (mobile), backdrop tap, and Esc.
- **Save note** button: shown only when the cell is already marked (`isColor(cell.state)`) and the trimmed note differs
  from the saved note (`(cell.note ?? '')`). It saves the existing colour with the new note and closes.
- **Clear** stays as today (only for marked cells), on the left of the footer. The footer renders only when Clear or
  Save note is shown.
- While a request is in flight, all choice buttons, Clear and Save note are disabled. On failure the sheet stays open
  and shows the error (`role="alert"`) as today.
- Choices keep `aria-pressed` for the saved state.

## 2. Note behind "+ Add note"

- If the cell has a saved note, the note field is open on arrival.
- Otherwise a text button **+ Add note** shows instead; tapping it reveals the textarea (focused) and hides the button.
- The textarea keeps its label "Note (optional)", `rows={2}` and `maxLength={500}`.
- Typing a note and then tapping a choice saves both.

## 3. Context row

Under the period line, one row:

- **Streak:** flame icon + number, when a streak is passed in (new optional `streak?: number` prop). Hidden when
  undefined. Same look as the Today card's flame (orange when > 0, dim at 0), with sr-only "Current streak ".
- **Time left:** the Today card's chip (clock icon + `formatTimeLeft(cell.closesAt, now, habit.frequency)`), with the
  same tones: `done` when marked, `urgent` when `isUrgent`, else `normal`. Hidden when `closesAt` is null or passed
  (`formatTimeLeft` returns null) — so past days opened from Progress show no chip. Needs a new `now: Date` prop.
- **This week:** for DAILY habits only, the same 7 short pills as the Today card (`habit.cells`, `h-1.5 w-4
  rounded-full`, PENDING/NOT_DUE → `bg-surface`, else `cellClass`), right-aligned, `aria-hidden`. The pill whose
  `date === cell.date` gets a ring (`ring-2 ring-fg ring-offset-1 ring-offset-card`).
- Chips and pill styles are shared with `HabitCard` rather than copied: move `chipBase`, `TONE_CLASS`/`Tone`, and the
  pill strip into a small shared module (`web/src/features/today/habitBits.tsx`) used by both.
- Callers: `TodayPage` passes `streak={streakFor(habit.id)?.current}` and `now`; `WeekPanel` passes the streak from
  its `streaks` query and `useNow()`.

## 7. Selected choice tinted in its colour

- Selected choice: border and a 14 % background in its own colour (`border-cell-green bg-cell-green/15`, yellow and
  red likewise). Unselected: unchanged (`border-line bg-surface`). No blue border.

## Out of scope

Undo for Clear, unsaved-note confirmation, focus trap, edit-habit link.

## Testing

- Update `WeekPanel.test.tsx` and `TodayPage.test.tsx` flows that click a choice then Save: a single choice tap now
  saves and closes; Cancel test becomes Esc/backdrop close.
- New tests: tap-to-save sends colour + note and closes; "+ Add note" hidden when a note exists and reveals the
  textarea otherwise; Save note appears only for a marked cell with a changed note and saves the existing colour;
  context row shows streak and time left, hides time left for a past cell, rings the opened day.
- e2e (`web/e2e`, `web/e2e-offline`): update any picker flows that press Save.
