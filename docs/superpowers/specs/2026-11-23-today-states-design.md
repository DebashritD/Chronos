# Today summary states and Geist headings — design

Approved 2026-11-23. Mockups: `today-states/states.png`, `fonts/sheet-*.png` (session files).

## Goal

Replace the Today page's bordered ring card ("Keep it off red") with a borderless summary whose words change with the
day's progress, and switch the app's heading font from Sora to Geist 600. Typical users track 4 to 5 habits.

## Layout (borderless, under the "Today" title and date)

- Left: **headline** (`font-display`, 26px, weight 600, tracking -0.035em) and a **line** beneath (15px, `text-muted`).
- Right, bottom-aligned with the line: **countdown** (13px, `text-dim`; `text-accent` when urgent). Hidden when every
  habit is marked or nothing is due.
- Below: **segments**, one per Today item in card order, `flex gap-1`, each `h-[5px] rounded-full`, coloured
  `bg-cell-green` / `bg-cell-yellow` / `bg-cell-red` when marked, else `bg-cell-grey`.
- No border, no card background. `<section aria-label="Today's progress">`; segments are `role="img"` with
  `aria-label` like "2 of 5 marked: 1 target, 1 minimum" (zero counts omitted; "0 of 5 marked" when none).
- Headline colour is `text-fg`, except states 3 and 10 use `text-cell-green`. Red never colours text.
- `ProgressRing.tsx` is deleted.

## Inputs

`items` (Today items), `now`, streaks (`habitId → current`). Derived: `total`, `marked`, `green`, `yellow`, `red`,
`open` = unmarked items, `earliest` = earliest `closesAt` among open items, `late` = `isUrgent(earliest, now)`
(under 3h), `urgentOpen` = open items with `isUrgent(closesAt, now)`.

## States (first match wins)

| # | Rule | Headline | Line |
|---|------|----------|------|
| 0 | total = 0 | Nothing due today | Enjoy the break. |
| 12 | all marked, red > 0 | All marked | `{total-red} off red, {red} missed. Tomorrow resets.` |
| 10 | all marked, all green | All green | `{total} of {total} on target today.` |
| 11 | all marked otherwise | All done | `{green} on target, {yellow} at minimum. All off red.` |
| 8 | late, an urgent open item has streak ≥ 7 (pick the longest; ties → card order) | `Keep the {n}-day streak` | `{name} is still open.` |
| 9 | late, marked = 0 | There’s still time | `A minimum on each keeps all {total} off red.` (1 habit: `A minimum keeps it off red.`) |
| 7 | late | `{h} hours left` (`1 hour left`; under 1h: `{m} minutes left`) | names of urgent open items: 1 → `{A} is still open.`, 2 → `{A} and {B} are still open.`, 3+ → `{k} habits are still open.` |
| 5 | open = 1, marked > 0 | `{name} is the last one` | Mark it to close the day. |
| 6 | red > 0 | Still in it | `{red} missed. The other {open} can stay off red.` |
| 1 | marked = 0 | Let’s start | `{total} habits today. The minimum counts.` (`1 habit today…`) |
| 3 | marked > total/2, yellow = 0 | Go green | `Almost there. {marked} of {total} on target.` |
| 4 | marked > total/2 | Almost there | `{marked} of {total} marked. {open} to go.` |
| 2 | otherwise | Good start | `{marked} of {total} marked. {open} to go.` |

Hours in state 7 are `floor`ed from `earliest`. Curly apostrophes in copy.

## Countdown text

From `earliest`: under 1h `{m}m left`; under 1 day `{h}h left`; else `{d}d left`. Urgent = `isUrgent(earliest, now)`.

## Heading font

- Add `@fontsource/geist` (600 only); remove `@fontsource/sora` and its imports in `main.tsx`.
- `--font-display: 'Geist', 'Inter', ui-sans-serif, system-ui, sans-serif`.
- `h1, h2, h3` and `.font-display` render at weight 600 with `letter-spacing: -0.035em` (pageTitle drops
  `font-extrabold` for `font-semibold`; other `font-extrabold`/`font-bold` on display text become `font-semibold`).

## Code shape

- `web/src/features/today/todaySummary.ts`: pure `todaySummary(items, now, streakOf): Summary` returning
  `{ headline, line, tone: 'default' | 'green', countdown: { text, urgent } | null, segments: CellState[], label }`.
- `web/src/features/today/TodaySummaryView.tsx`: renders it.
- `TodayPage.tsx`: drops `encouragement` and the ring card; renders `<TodaySummary …/>`.

## Testing

- `todaySummary.test.ts`: one case per state (0–12) plus pluralisation (1 habit, 1 hour, minutes) and the 3+ names
  case.
- `TodayPage.test.tsx`: replace ring/encouragement assertions with headline, line and segment label checks.
