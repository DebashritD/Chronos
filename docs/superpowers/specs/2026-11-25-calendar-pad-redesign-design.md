# Calendar pad redesign

**Date:** 2026-11-25
**Status:** Approved through mockups, awaiting spec review
**Mockups:** `~/Docspace/Chronos/Design Directions/E - Calendar pad (combined)/` (`e-today.png`, `e-week.png`, `e-month.png`, `e-habits.png`, `e-me.png`, `e-icon.png`); source `…/source/e.html`, `icon-a.svg`, `icon-a-small.svg`. The mockup is kept in sync with every decision in this spec.

## Goal

Replace the dark, card-heavy "night and sky blue" look with a light **calendar pad**: paper sheets bound at the top, ruled rows instead of cards, a serif display face, ink stamps for marked habits and dot-and-line markers on Progress. One release covering every screen.

The redesign changes the look, not what the app does. The only behaviour changes are listed under [Behaviour changes](#behaviour-changes).

## Behaviour changes

1. **Today collapses Target and Minimum.** A habit marked GREEN or YELLOW becomes a stamped row and moves to the bottom (today only GREEN does). RED rows keep their buttons and the "That's honest…" note. The "Done" heading stays and sits above the first stamped row.
2. **Stamp-press animation.** Marking Target or Minimum plays a short stamp press (about 220 ms: scale 1.12 → 1, rotation settles to its resting angle, ink fades in). It replaces the current `pop`. When the device has reduced motion on, there is no animation. Haptics are unchanged.
3. **Wording.** In the user interface, "yellow" becomes "Minimum" and "green" becomes "Target":
   - Account: "Yellows allowed in a row" → "Minimums allowed in a row".
   - Habit form: "Bare minimum (YELLOW)" → "Minimum"; "Target (GREEN)" → "Target"; "Limit yellows in a row" → "Limit minimums in a row".
   - Any other user-visible "yellow" or "green" text (e.g. Habits page, empty states, the yellow-limit warning).
   - API names, types and code identifiers are not renamed.
4. **The app is renamed "No Reds".** Every user-visible "Chronos" becomes "No Reds": the page `<title>`, the manifest `name` and `short_name`, the wordmark, and the offline error ("Couldn't reach No Reds…"). The repository, package names, code identifiers and the Render URL are unchanged.
5. **Account streak rule uses a stepper** (− value +, range 1–7) instead of a number input. It still saves with "Save rule".

## Visual system

### Colour tokens (light only)

`color-scheme: light`. The dark theme is removed.

| Token | Value | Use |
|---|---|---|
| `paper` | `#f7f3ea` | page sheet |
| `paper-2` | `#e9e2d4` | tab bar, behind-sheet edges, sheet backdrop |
| `binding` | `#2c2a27` | top binding strip, PWA status bar |
| `ink` | `#1d1b18` | primary text, filled buttons |
| `muted` | `#665e53` | secondary text (≥ 4.5:1 on paper and paper-2) |
| `faint` | `#a89f8f` | decorative only: future-day circles, dashed dividers |
| `ring` | `#857d70` | open-today circles (≥ 3:1 on paper) |
| `rule` | `#e3dbcb` | row separators |
| `rule-2` | `#d6ccb9` | section separators, input underlines |
| `accent` | `#b0361f` | eyebrows, active tab underline, today's column, Log out |
| `green` | `#1a7a43` | Target marks, stamps and text |
| `yellow` | `#c08a00` | Minimum fill (graphics only) |
| `yellow-ink` | `#8a6200` | Minimum text, stamp ink, the outline of Minimum dots |
| `red` | `#c4391f` | Missed marks |
| `score-0…4` | `#c4391f`, `#d9761a`, `#c08a00`, `#7a9a2a`, `#1a7a43` | month daily score |

These are the mockup colours, with `muted` and `green` darkened and `yellow-ink` added so that every text colour meets 4.5:1 on paper. Text never uses `yellow` or `faint`. The implementation adds a unit test that checks these contrast pairs.

### Type

Self-hosted through `@fontsource`, so offline use keeps working. Inter and Geist are removed.

- **Instrument Serif** (400): display numerals, page headlines, habit names, streak numbers.
- **IBM Plex Sans** (400, 500, 600): interface text, buttons, eyebrows.
- **IBM Plex Mono** (400, 500): meta lines, streak lines, countdowns, stamps, counts.

Eyebrows: 11–12 px Plex Sans 600, uppercase, 0.22em tracking, `accent`.

### Page chrome

- **Binding strip:** `binding`-coloured bar at the top, with a row of punched holes (radial gradient). It sits under the safe-area inset and matches the PWA `theme-color`.
- **Sheet:** `paper`, with a perforated top edge and 2–3 stacked sheet edges below it (box shadows in `paper-2` and `rule-2`). One sheet per screen; no cards inside it.
- **Structure:** sections are separated by 1 px rules (`rule` between rows, `rule-2` between sections). No rounded boxes, no card backgrounds, no glows.
- **Tab bar (mobile):** a `paper-2` bar with four text tabs (Today, Progress, Habits, Me) in Plex Sans 600. The active tab is `ink` with a 2 px `accent` underline; inactive tabs are `muted`. Icons are removed. The visible label is the accessible name, so existing tests that find tabs by name keep working.
- **Desktop (md and up):** the sidebar is removed. The binding strip carries the "No Reds" wordmark (serif) and the same four text tabs. The sheet is centred (max width about 760 px). Today keeps its week and streak side column on lg screens, separated by a vertical rule.
- **Logo:** the conic-gradient tile is replaced by the new app icon plus a serif "No Reds" wordmark.

`lib/ui.ts` is rewritten around this system. `card`, `chip` and `cardTitle` are removed. The new helpers are `eyebrow`, `pageTitle` (serif), `rowRule`, `underlineInput`, `inkButton` (ink fill, radius 8), `outlineButton` and `textButton`.

## Screens

### Today (`e-today.png`)

- **Header:** a weekday eyebrow ("WEDNESDAY"); the date as a 92 px serif numeral; to the right, "November 2026" and the countdown ("9h 40m left") in mono, in `accent` when urgent.
- **Summary:** the headline from `todaySummary` is shown as a 24 px serif line under the header, with its sentence beneath it in muted text (e.g. "Good start" / "2 of 4 marked. The minimum counts."). The coloured segment bar is removed (the rows show state), but its "N of M marked…" label stays as visually hidden text so screen readers still get the summary.
- **Open rows:** each habit is a ruled `<article>` row (its accessible name is unchanged):
  - the serif habit name at 27 px;
  - a mono streak line (see below);
  - three equal text buttons, "● Target", "◐ Minimum", "✕ Missed", each at least 44 px tall and separated by dashed `faint` dividers. Their accessible names stay "Target", "Minimum" and "Missed" (the symbols are `aria-hidden`), with `aria-pressed` as now;
  - the yellow-limit warning ("restarts streak") and the RED "That's honest…" note stay, restyled as mono text under the buttons.
- **Stamped rows (GREEN or YELLOW):** the habit name, the streak line, and a rotated double-border stamp in mono capitals, "● TARGET" in `green` or "◐ MINIMUM" in `yellow-ink`. The whole row stays a button that reopens the marking buttons, as GREEN does today, and focus moves to it after collapsing.
- **Streak line:**
  - DAILY: "**N** days unbroken"; WEEKLY: "**N** weeks unbroken"; EVERY_N_DAYS: "**N** in a row".
  - Non-daily habits add the time left ("· 4d 2h left", from the existing time-left text). Daily habits add it only once it is urgent (the header already shows the day's countdown). Urgent time left is `accent`.
  - With no streak, the line reads "Fresh start".
- The "Done" heading, ordering and flat keyed list are unchanged apart from YELLOW joining the collapsed group.
- WeekPills and the frequency chip are removed from the rows. Frequency appears in the streak line's units.

### Progress, week (`e-week.png`)

- Eyebrow "PROGRESS" and a serif headline: "No red this week" when the displayed week has no RED, otherwise the week range.
- A Week / Month text toggle with an `accent` underline on the active one (it keeps the `view` search parameter).
- Navigation: "‹ 23 – 29 November ›" in serif. The accessible names "Previous week", "Next week" and "This week" are unchanged.
- **Grid:** Monday first. The header has weekday letters and serif dates; today's column has a 6% `accent` tint and an `accent` letter; future dates are faded.
- **Each row:** the serif habit name with mono frequency under it, then the marks. Every segment from `weekSegments` stays a `WeekCellButton` with its current accessible name, at least 44 px tall, that opens the picker.
- **Marks:**
  - GREEN: a filled `green` dot.
  - YELLOW: a half-filled `yellow` dot with a `yellow-ink` outline.
  - RED: a `red` ✕.
  - Open today: an empty circle (`ring` stroke).
  - Future or not yet due: a fainter empty circle.
  - NOT_DUE gaps: nothing.
- **Lines and brackets:**
  - Adjacent non-RED daily marks are joined by a 1.5 px line in the mark colour.
  - Every-N-days and weekly periods are a bracket on the same line as the dot: a thin line spanning the period, with end ticks, and the dot centred in it.
- **Bright and dim:** in each row, marks after the row's last RED in the displayed range are at full opacity; RED marks are at full opacity; marks before the last RED are at 30%. A one-line legend below the grid explains it ("Bright = current run · dim = before the last miss"). This is computed from the displayed cells only, with no API change.
- **This week:** "N due so far", the % Target as a large serif number, a stacked bar (Target, Minimum, Missed, and open shown hatched), and mono counts with the ● ◐ ✕ shapes. This replaces DistributionDonut's ring; its accessible text stays.
- **Streaks · now · best:** ruled list of a serif name, the current streak in serif, and "best N" in mono. A habit whose current streak is 0 is shown at 45% opacity. The Flame icon is removed. List items keep the habit name as their accessible name.

### Progress, month (`e-month.png`)

- A serif month headline ("November"), the same toggle, navigation, and the "This month" button.
- **Daily score:** a Monday-first wall calendar. Each day is a serif numeral on a 34 px circle in its score colour:
  - step 4 is solid `green` with `paper` numerals;
  - steps 0–3 are tinted at 32% opacity with `ink` numerals;
  - unmarked, today and future days are an empty `faint` ring.
  - A gradient legend runs from "Missed" to "Target".
  - `scoreClass` keeps its thresholds; only its classes change. Day accessible labels are unchanged.
- **Distribution:** the same stacked bar and counts as the week view.
- **By habit · % Target:** one ruled row per habit with its serif name, a strip of one dot per day of the month (same shapes and bright/dim rule as the week view; empty rings for unmarked or future days), and a mono % Target. This replaces the per-habit mini calendars.

### Habits (`e-habits.png`)

- Eyebrow "YOUR PAD", serif headline "Habits".
- **Rows:** a serif name; a mono line "daily · since 25 Oct · **31** run"; and 44 px line-icon buttons for edit, pause or resume, and archive (accessible names unchanged).
- A paused habit is at 50% opacity with a small rotated `accent` "PAUSED" stamp.
- The archived section stays a `<details>`, styled as "▸ ARCHIVED (2)".
- The "New habit" button becomes a floating `ink` pill, "+ New habit", in the same position as now.
- **Habit form:** underline inputs, a frequency segmented control as text with an underline, an `inkButton` to save, and the wording from Behaviour changes. Fields and validation are unchanged.

### Me (`e-me.png`)

- Eyebrow "ACCOUNT"; the user's initial in an `accent` double-ring stamp; the serif username; and mono "Asia/Kolkata · day ends 00:00".
- Ruled sections:
  - **TIMEZONE:** an underline input (keeping the datalist), a note, and "Use this device" (outline) and "Save" (ink) buttons.
  - **STREAK RULE:** serif "Minimums allowed in a row", the − value + stepper with a 48 px serif value (the buttons are labelled "Fewer" and "More", and the value is announced), a note, and "Save rule".
  - **PASSWORD:** underline inputs and "Change password".
- A dashed rule, then "↩ Log out" in `accent`. The unsynced-marks confirmation dialog is unchanged in behaviour and restyled.

### Unmocked surfaces (same language)

- **CellPicker sheet:** a `paper` sheet with a perforated top edge over a dimmed `paper-2` backdrop. The serif habit name and period come first, then ruled option rows ("● Target", "◐ Minimum", "✕ Missed", "Clear") of at least 44 px. Its accessible names, focus trap and closing behaviour are unchanged.
- **Auth (login and sign-up):** the binding strip and sheet, the app icon and serif "No Reds" wordmark, underline inputs, and an ink submit button.
- **EmptyState:** a serif title, a muted body, and the action as an `ink` text link with an underline (accessible names unchanged).
- **WakingNotice, SyncToast and sync status:** small ink-on-paper mono notes with no pill boxes. SyncToast is an `ink` bar with `paper` text.
- **PullToRefresh:** the indicator uses `ink` and `faint`.
- **Dialogs:** a `paper` sheet with rules and `ink` / `outline` buttons.

## App icon (`e-icon.png`)

"Pad + run": the top 29% is the `binding` strip with four punched holes in `paper-2` and a perforated lower edge; below it is `paper`, with the run ◐ — ● — ● (Minimum, Target, Target) centred: a half-filled `yellow` dot with a `yellow-ink` outline, then two filled `green` dots, joined by lines in the colour of the mark they lead into.

- Source: `icon-a.svg` (1024 px, full bleed; the platform applies the corner mask) and `icon-a-small.svg` (64 px simplified: two holes, no perforation, bolder marks) for 32 px and smaller.
- Generated files replace those in `web/public/`: `favicon.svg` (from the small version), `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, and `icon-maskable-512.png` (the artwork scaled to the central 80% safe zone on `paper`).

## PWA

- `index.html`: `theme-color` becomes `#2c2a27` (binding).
- `manifest.webmanifest`: `name` and `short_name` become "No Reds", `theme_color` becomes `#2c2a27` and `background_color` `#f7f3ea`.
- `index.html`: `<title>` becomes "No Reds".

## Accessibility

- Every text colour pair is at least 4.5:1, and mark graphics are at least 3:1 (see tokens).
- State never relies on colour alone: ● ◐ ✕ and empty circles are distinct shapes everywhere.
- Touch targets are at least 44 px.
- Accessible names, roles and heading levels that tests rely on stay the same: the `article` per habit; the "Target", "Minimum" and "Missed" buttons; the tab names; "Previous week" and "Next week"; and the `listitem` habit names. Copy changes from Behaviour changes are updated in the tests.
- Reduced motion turns off the stamp press, the row move and other transitions (the existing global rule).
- Focus rings are a 2 px `ink` outline with a 2 px offset.

## Out of scope

- API or data changes.
- A dark theme.
- The marketing landing page.

## Testing and verification

- Unit tests:
  - Today collapses YELLOW as well as GREEN;
  - the streak-line text for each frequency and for "Fresh start";
  - the bright and dim rule (marks before the last RED are dimmed);
  - the account stepper's range (1–7);
  - the palette contrast pairs.
  - Existing tests are updated only where copy or behaviour changed.
- Run vitest, lint and build, and both end-to-end suites (online and offline).
- Take real-app screenshots on iPhone 13 of Today, Progress week and month, Habits and Me, and compare them with the mockups. Run the impeccable detector on the changed files.
- After the build, write a `DESIGN.md` from the shipped code.
