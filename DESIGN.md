---
name: No Reds
description: A habit tracker drawn as a tear-off calendar pad, light paper bound in dark board, with ink marks and rubber stamps.
colors:
  paper: "#f7f3ea"
  paper-2: "#e9e2d4"
  binding: "#2c2a27"
  ink: "#1d1b18"
  muted: "#665e53"
  faint: "#a89f8f"
  ring: "#857d70"
  rule: "#e3dbcb"
  rule-2: "#d6ccb9"
  accent: "#b0361f"
  cell-green: "#1a7a43"
  cell-yellow: "#c08a00"
  yellow-ink: "#8a6200"
  cell-red: "#c4391f"
  score-0: "#c4391f"
  score-1: "#d9761a"
  score-2: "#c08a00"
  score-3: "#7a9a2a"
  score-4: "#1a7a43"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "78px"
    fontWeight: 700
    lineHeight: 0.85
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Bricolage Grotesque, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Bricolage Grotesque, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "23px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.03em"
  title-sm:
    fontFamily: "Bricolage Grotesque, Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  control:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
  meta:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
    fontFeature: "tnum"
  stamp:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "13px"
    fontWeight: 500
    letterSpacing: "0.14em"
  label:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.22em"
rounded:
  none: "0px"
  stamp: "6px"
  button: "8px"
  full: "9999px"
spacing:
  row: "16px"
  section-gap: "28px"
  section-pad: "20px"
  sheet-x: "24px"
  sheet-x-md: "40px"
  touch: "44px"
components:
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.button}"
    padding: "0 20px"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "0 20px"
    height: "44px"
  button-text:
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    height: "44px"
  button-icon:
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: "44px"
  button-icon-hover:
    backgroundColor: "{colors.paper-2}"
  input-underline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "10px 0"
  tab-bar:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.muted}"
    typography: "{typography.control}"
    height: "60px"
  tab-bar-active:
    textColor: "{colors.ink}"
  stamp-target:
    textColor: "{colors.cell-green}"
    typography: "{typography.stamp}"
    rounded: "{rounded.stamp}"
    padding: "6px 10px"
  stamp-minimum:
    textColor: "{colors.yellow-ink}"
    typography: "{typography.stamp}"
    rounded: "{rounded.stamp}"
    padding: "6px 10px"
  score-day:
    rounded: "{rounded.full}"
    size: "34px"
  score-day-full:
    backgroundColor: "{colors.score-4}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    size: "34px"
---

# Design System: No Reds

## Overview

**Creative North Star: "The Tear-off Calendar Pad"**

Every screen is one sheet torn from a desk calendar. A dark binding board runs across the top with a row of punched holes; below it hangs a single warm paper sheet with a perforated top edge and a thin stack of sheets showing underneath. Nothing floats on the sheet. Content is set straight onto the paper and divided the way a ledger is divided, with hairline rules, so the whole app reads as printed matter that a person marks by hand.

The marks carry the meaning. A habit's day is a filled dot (Target), a half-filled dot (Minimum), an ✕ (Missed), or an empty circle (open or still ahead). A day that is done on Today gets a rubber stamp, set at a slight angle in coloured ink. Display type is an ink-trapped workshop grotesque for dates, names and numerals; the interface is a quiet grotesque; anything counted, timed or stamped is in a date-stamp mono.

The palette is quiet paper and ink, with colour reserved for the marks themselves and one brick-red accent for orientation (today, the active tab, section labels). Density is calm and single-column on phones, with generous ruled rows and 44 px touch targets throughout.

**Key Characteristics:**
- One paper sheet per screen under a punched binding; no cards, no boxes inside it.
- Sections and rows separated only by 1 px rules.
- State is always a shape (● ◐ ✕ ○), never colour alone.
- Display grotesque for names and numerals, sans for interface, mono for meta, counts and stamps.
- Light only (`color-scheme: light`); no glows, no blur.

## Colors

Warm off-white paper and near-black ink, with mark colours that look like stamp-pad inks and a single brick-red accent.

### Primary
- **Brick Accent** (accent): today's column tint (at 6%) and letter, the active tab underline, the active Week/Month underline, section labels, urgent countdowns, the account initial stamp, the PAUSED stamp, and Log out.

### Secondary (mark inks)
- **Ledger Green** (cell-green): Target dots, the TARGET stamp, Target counts and lines.
- **Mustard Fill** (cell-yellow): the filled half of a Minimum dot and its share of the distribution bar. Graphics only.
- **Mustard Ink** (yellow-ink): Minimum text, the MINIMUM stamp, the outline of Minimum dots, the "restarts streak" warning.
- **Correction Red** (cell-red): the Missed ✕, Missed counts, inline errors.

### Tertiary (score scale)
- **Daily Score Ramp** (score-0 → score-4): the month wall calendar, red through orange, mustard and olive to green. Steps 0–3 are tinted at 30% behind ink numerals; step 4 is solid with paper numerals.

### Neutral
- **Sheet Paper** (paper): the page sheet, dialogs and the cell picker.
- **Underleaf** (paper-2): the body behind the sheet, the mobile tab bar, the holes punched in the binding, pressed states on icon and choice buttons.
- **Binding Board** (binding): the top strip and PWA theme colour; at 45% it is the backdrop behind sheets and dialogs.
- **Ink** (ink): primary text, filled buttons, focus outlines.
- **Pencil** (muted): secondary text, notes, inactive tabs, meta lines.
- **Faint Pencil** (faint): decorative only, never text: dashed dividers between Today's choice buttons, the paused dash, the month calendar's unmarked-day ring, and the strikethrough line on done tasks.
- **Ring** (ring): the open-today circle.
- **Rule** (rule): row separators.
- **Rule Heavy** (rule-2): section separators, input underlines, outline-button borders, future-day circles, the hatched unmarked share.

### Named Rules
**The Ink-Only Text Rule.** Text uses ink, muted, accent, cell-green, yellow-ink or cell-red, each at least 4.5:1 on paper. Text never uses cell-yellow or faint.

**The Colour Belongs to Marks Rule.** Green, mustard and red appear only on marks, stamps, counts and the score scale. Chrome and surfaces stay paper, ink and rules.

## Typography

**Display Font:** Bricolage Grotesque (variable, optical sizes; with Hanken Grotesk, system-ui)
**Body Font:** Hanken Grotesk (with ui-sans-serif, system-ui)
**Label/Mono Font:** Geist Mono (with ui-monospace, Menlo)

**Character:** A workshop grotesque. Bricolage's ink traps and optical sizes give the big printed things (dates, names, numerals) a hand-cut, letterpress feel while staying legible small; Hanken Grotesk is a quiet, open interface face; Geist Mono reads like a date stamp, with clean tabular figures. All three are self-hosted through `@fontsource` (Bricolage as the `opsz` variable font, latin subset), and the body sets tabular numerals so ticking countdowns don't jitter.

### Hierarchy
- **Display** (Bricolage 700, 54–78 px, line-height 0.85–1, −0.04em): today's date numeral (78 px), the large % Target figure (54 px), the account stepper value (40 px).
- **Headline** (Bricolage 600, 29–38 px, line-height ~1.05, −0.03em): page titles ("Habits", "No red this week", the month name, the username), the sign-in headline.
- **Title** (Bricolage 600, 15–26 px, tight, −0.03em): habit names (23 px on Today, 16–19 px in grids and lists), the summary headline (21 px), sheet titles (26 px), week and month navigation; streak numbers in 700.
- **Body** (Hanken Grotesk 400–600, 14–16 px): sentences, notes, buttons (15 px, 600 for ink buttons), choice buttons (14 px, 500). Inputs are 16 px.
- **Meta** (Geist Mono 400–500, 11–13 px): streak lines, frequencies, countdowns, counts, legends and stamps (13 px, 0.14em, capitals).
- **Label / eyebrow** (Hanken Grotesk 600, 10–11 px, uppercase, 0.14–0.22em): used both above a page title ("Your pad", "Progress", "Account", Today's weekday) and as the heading of a ruled section ("Streaks", "Daily score", "Timezone"), in accent; weekday letters over grid columns, in muted.

### Named Rules
**The Two Weight Display Rule.** `font-display` defaults to Bricolage 600 at −0.03em. Big numerals (date, % Target, stepper, streak counts) step up to 700 at −0.04em. Nothing lighter than 600 and nothing heavier than 700; the display face is never set for sentences.

**The Mono Means Measured Rule.** Anything counted, timed or stamped is mono. Names and prose are never mono.

## Layout

A single sheet, centred, capped at 1080 px. Sheet padding is 24 px on phones and 40 px from `md` up; the top padding is 28 px (40 px on desktop). Content stacks in one column on phones; sections follow one another with a 28 px gap above a `rule-2` line and 20 px below it. Rows inside a section are about 16 px top and bottom, divided by `rule`.

On phones a fixed 60 px tab bar sits at the bottom (plus the safe-area inset), and the sheet pads 88 px at the bottom to clear it. From `md` up the tab bar disappears; the binding grows to 56 px and carries the display wordmark and the four text tabs, and the binding's punched holes are dropped. Today adds a side column on `lg` separated by a vertical rule.

Grids are seven columns, Monday first. Every tappable thing is at least 44 px tall (44 × 44 for icon buttons).

## Elevation & Depth

Flat. Depth is told through paper, not light: the sheet sits on `paper-2`, its stacked edges are five hard 2 px offset bands below it, and its top edge is perforated against the binding. Nothing on the sheet itself casts a shadow. Overlays (dialogs, the cell picker) are another paper sheet over a 45% binding wash; dialogs and the small floating notices that sit above the sheet carry a soft shadow so they read as lifted.

### Shadow Vocabulary
- **Sheet stack** (`box-shadow: 0 2px 0 #ddd5c4, 0 4px 0 #f1ebdf, 0 6px 0 #d8cfbe, 0 8px 0 #efe8da, 0 10px 0 #d3c9b6`): only under the main sheet, to show the pad's remaining pages.
- **Stamp double rule** (`box-shadow: inset 0 0 0 2px paper, inset 0 0 0 3.5px currentColor`): the inner rule of every rubber stamp; not depth.
- **Floating pill** (`box-shadow: 0 6px 18px rgb(29 27 24 / 0.25)`): the phone "+ New habit" pill, which floats above the tab bar; removed from `md` up.
- **Dialog lift** (`box-shadow: 0 20px 50px rgb(29 27 24 / 0.25)`): the yellow-limit dialog and the Account confirm dialog.
- **Notice lift** (`box-shadow: 0 8px 24px rgb(29 27 24 / 0.3)`): the sync toast and the waking notice, both ink pills over the sheet.
- **Refresh chip** (`box-shadow: 0 6px 18px rgb(29 27 24 / 0.18)`): the pull-to-refresh indicator.

### Named Rules
**The Paper Not Light Rule.** Depth comes from paper layers, perforations and stacked edges. No glows, no blur, no soft card shadows on the sheet; soft shadows are reserved for things floating above it.

## Shapes

Mostly square and ruled: rows and sections have no corners at all, and inputs are a single underline. Rounding is kept for things a hand would hold or press: 8 px on ink and outline buttons, 6 px on stamps, full circles for icon buttons, marks, score days and the floating pill. Repeating patterns are drawn with gradients: punched holes (22 px pitch), the perforation (10 px pitch), and 45° hatching for unmarked or paused stretches. Week lines and period brackets are 1.5 px.

## Components

### Buttons
Plain and pressable, like a pen on paper.
- **Shape:** gently rounded (8 px); icon buttons are circles.
- **Ink:** ink fill, paper text, 15 px Hanken Grotesk 600, 20 px side padding, 44 px tall; hover drops to 90% opacity. The default for saving and submitting.
- **Outline:** a 1.5 px `rule-2` border with ink text, 500 weight. For the secondary choice beside an ink button ("Use this device").
- **Text:** ink text with a 2 px `rule-2` underline offset 6 px, turning ink on hover. For low-key actions and empty-state links.
- **Icon:** 44 px circle, ink line icon, `paper-2` fill on hover and press.
- **Focus:** buttons and links show a 2 px ink outline with a 2 px offset. Underline inputs and the frequency select drop the outline (`focus:outline-none`) and show focus by their underline turning ink.
- **Disabled:** 50% opacity (icon buttons 40%).

### Inputs / Fields
- **Style:** no box; a 1 px `rule-2` underline, transparent background, 16 px ink text, muted placeholder.
- **Focus:** the underline turns ink.
- **Error:** a short line of cell-red text below the field.

### Navigation
- **Phone:** a `paper-2` bar with four text tabs in the order Today · Tasks · Progress · Me, in 13 px Hanken Grotesk 600, no icons. Inactive tabs are muted; the active one is ink with a 2 px accent underline.
- **Desktop:** the same four tabs in the binding, paper at 65% when inactive and full paper with an accent underline when active.
- **Manage habits** is reached from Me (an outline button on the Me sheet opens `/habits`), not a tab; Me stays lit while it is open.
- **View toggles** (Week / Month) use the same text-and-underline pattern. Habit frequency is a native `<select>` on an underline with a chevron (`.select-chevron`), not a toggle.

### Marks
The pad's alphabet, drawn as 16 px SVG and always paired with a text label.
- **Target:** solid cell-green dot.
- **Minimum:** paper dot with a 1.6 px yellow-ink outline, left half filled cell-yellow.
- **Missed:** cell-red ✕, 2.2 px round-capped strokes.
- **Open:** paper circle with a 1.5 px ring stroke.
- **Future:** paper circle with a 1.2 px rule-2 stroke.
- **Paused:** a short faint dash.
- **Not due:** nothing.
- **Bright and dim:** in each row, every Missed mark is at full strength, and so is everything after the last Missed. Non-Missed marks before the last Missed drop to 30%.
- **Runs:** adjacent daily marks are joined by a 1.5 px line in the mark's colour; longer periods are a 1.5 px bracket with end ticks and the dot centred on it.

### Rubber Stamp
Shown on a done row on Today: mono capitals at 13 px with 0.14em tracking, a Mark at 11 px, a 2.5 px border with a 6 px radius and an inner rule. TARGET is cell-green, rotated −7°; MINIMUM is yellow-ink, rotated 5°. Marking a habit plays a 240 ms stamp press (scale 1.18 → 1, ink fades in, `cubic-bezier(0.2, 0.9, 0.3, 1.25)`); under reduced motion nothing animates. The same double rule frames the accent initial on Me and the small PAUSED stamp on Habits.

### Choice Row
Today's open row: a display name, a mono streak line, then three equal 44 px buttons, "● Target", "◐ Minimum", "✕ Missed", split by dashed faint dividers, with `paper-2` on press.

### Task row
A 22px square box with a 1.5px ink outline and an ink check when done (never green: colour belongs to marks). The text is Hanken 17px. Done rows are struck through in `muted` with a `faint` line and sink below open rows. The carry-over age is mono 12px muted ("carried 3 days"). Later rows have a dashed `ring` box and a "Do today" text button. Swiping left shows an ink panel ("Move to Later", then "Delete"; Later rows show only "Delete"), and deleting shows an Undo bar for 5s. While a row is being edited, "Later" (open rows) and "Delete" text buttons follow the input, so mouse, keyboard and screen-reader users can do the same without a swipe.

### Distribution Bar
A full-width rounded bar split Target / Minimum / Missed, with the unmarked share hatched, over a mono legend that repeats each shape with its count.

### Daily Score Calendar
A seven-column wall calendar of 34 px circles with 15 px display numerals in their score colour (see Colors); unmarked, today and future days are empty rings.

## Do's and Don'ts

### Do:
- **Do** put each screen on one paper sheet under the binding, with sections divided by `rule-2` lines and rows by `rule` lines.
- **Do** draw every state as its shape (● ◐ ✕ ○) and pair it with a word; the user-facing words are Target, Minimum and Missed.
- **Do** set names and numerals in Bricolage Grotesque (600, numerals 700), interface in Hanken Grotesk, and counts, times and stamps in Geist Mono.
- **Do** keep every touch target at least 44 px and show the 2 px ink focus outline.
- **Do** keep Missed marks bright and dim the earlier marks (30%) before the last Missed in a row.
- **Do** let reduced motion stop every animation.

### Don't:
- **Don't** put cards, rounded boxes, background panels, glows or backdrop blur on the sheet.
- **Don't** use cell-yellow or faint for text; Minimum text is yellow-ink.
- **Don't** use "yellow" or "green" in copy; "red" appears only in "No red" / "off red".
- **Don't** set Bricolage below 600, above 700, or for sentences.
- **Don't** add a dark theme or a second accent colour.
