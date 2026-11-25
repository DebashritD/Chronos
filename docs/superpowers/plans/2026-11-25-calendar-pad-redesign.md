# Calendar Pad Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark card UI with the approved light "calendar pad" design, and rename the app to "No Reds" with a new icon.

**Architecture:** Task 1 swaps the design tokens and keeps the old token names as light-valued aliases, so every screen stays legible while the later tasks restyle it one at a time. Task 3 adds shared shape primitives (`Mark`, `markKind`, `brightness`). Screens are then rebuilt on those primitives. Task 10 deletes the aliases and any deprecated helpers.

**Tech Stack:** React 19, TypeScript, Tailwind v4 (`@theme` tokens in `web/src/index.css`), Vitest and Testing Library, Playwright, and `@fontsource` fonts.

**Spec:** `docs/superpowers/specs/2026-11-25-calendar-pad-redesign-design.md`
**Mockups (source of truth):** `~/Docspace/Chronos/Design Directions/E - Calendar pad (combined)/e-{today,week,month,habits,me,icon}.png`; HTML in `~/Docspace/Chronos/Design Directions/source/e.html`.

## Global Constraints

- Light theme only, with `color-scheme: light`. No glows, no card boxes, no backdrop blur. Sections are separated by 1 px rules.
- Token values must be copied exactly:
  - `paper #f7f3ea`, `paper-2 #e9e2d4`, `binding #2c2a27`, `ink #1d1b18`, `muted #665e53`, `faint #a89f8f`, `ring #857d70`, `rule #e3dbcb`, `rule-2 #d6ccb9`, `accent #b0361f`;
  - `cell-green #1a7a43`, `cell-yellow #c08a00`, `yellow-ink #8a6200`, `cell-red #c4391f`;
  - `score-0..4`: `#c4391f #d9761a #c08a00 #7a9a2a #1a7a43`.
- Text never uses `cell-yellow` or `faint`. Minimum text uses `yellow-ink`.
- Fonts are self-hosted through `@fontsource`:
  - Instrument Serif (400) for display, names and numerals;
  - IBM Plex Sans (400/500/600) for the interface;
  - IBM Plex Mono (400/500) for meta text, streaks, countdowns, stamps and counts.
  - Never use font-weight 600 or more on Instrument Serif; it only has 400.
- Eyebrow style: `text-[11px] font-semibold tracking-[0.22em] text-accent uppercase`.
- Words users see: **Target**, **Minimum**, **Missed**. "yellow" and "green" never appear in the UI; "red" stays only in the product phrase "off red" / "No red".
- The app's visible name is **No Reds**. Never rename the repository, package or identifiers.
- Every state is a distinct shape: ● Target, ◐ Minimum, ✕ Missed, ○ open, faint ○ future. Never rely on colour alone.
- Touch targets are at least 44 px (`min-h-11` / `h-11 w-11`).
- Keep accessible names and roles stable unless a task explicitly changes them. These include:
  - `article` per habit;
  - the buttons "Target", "Minimum" and "Missed" (exact);
  - "Previous week" / "Next week" / "This week" and "Previous month" / "Next month" / "This month";
  - `listitem` per habit;
  - the regions "Streaks", "Daily score" and "Today's progress".
- When the device has reduced motion on, nothing animates. The global rule already exists in `index.css`; keep it.
- Run all commands from `web/`. Run validation with `npx vitest run && npm run lint && npm run build`; lint has 2 expected existing warnings.
- Never stage `PRODUCT.md` at the repository root.
- End each commit message with the trailer `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.

## File map

| File | Responsibility | Task |
|---|---|---|
| `web/src/index.css` | tokens, fonts, chrome utilities (`binding`, `perforated`, `sheet-edges`, `hatched`, `stamp`), keyframes | 1, 4, 10 |
| `web/src/lib/ui.ts` | shared class strings | 1, 10 |
| `web/src/lib/palette.test.ts` | contrast checks against `index.css` | 1 |
| `web/src/main.tsx`, `web/package.json` | font imports and dependencies | 1 |
| `web/src/app/Shell.tsx`, `tabs.ts`, `Logo.tsx` (delete `TabIcons.tsx`) | binding strip, text tabs, wordmark | 2 |
| `web/icons/icon.svg`, `web/icons/icon-small.svg`, `web/scripts/render-icons.mjs`, `web/public/*` icons, `index.html`, `manifest.webmanifest`, `src/api/errors.ts` | icon, rename, PWA colours | 2 |
| `web/src/app/Mark.tsx`, `web/src/lib/brightness.ts`, `web/src/lib/cells.ts` (`markKind`) | shape primitives | 3 |
| `web/src/features/today/*` (`streakText.ts`, `Stamp.tsx`, `habitBits.tsx`, `HabitCard.tsx`, `TodayPage.tsx`, `TodaySummaryView.tsx`, `todaySummary.ts`), `lib/dates.ts` (`formatWeekday`) | Today | 4 |
| `web/src/features/progress/{ProgressPage,WeekPanel,WeekTiles,WeekCellButton}.tsx` (delete `WeekGrid.tsx`) | Progress week | 5 |
| `web/src/features/stats/{DistributionBar,StreakList}.tsx` (delete `DistributionDonut.tsx`) | stats blocks | 6 |
| `web/src/features/progress/{MonthPanel,CalendarGrid}.tsx` | Progress month | 7 |
| `web/src/features/habits/{HabitsPage,HabitForm}.tsx`, `web/src/app/YellowLimitProvider.tsx` | Habits and Minimum-limit copy | 8 |
| `web/src/features/account/AccountPage.tsx`, `web/src/app/Stepper.tsx` | Me | 9 |
| `CellPicker`, `AuthLayout`, `LoginPage`, `SignupPage`, `EmptyState`, `SyncToast`, `SyncStatus`, `WakingNotice`, `PullToRefresh`, `e2e/*` | remaining surfaces and cleanup | 10 |
| `DESIGN.md` | design system record | 11 |

---

### Task 1: Tokens, fonts and shared classes

**Files:**
- Modify: `web/package.json`, `web/src/main.tsx`, `web/src/index.css`, `web/src/lib/ui.ts`
- Test: `web/src/lib/palette.test.ts` (create)

**Interfaces:**
- Produces:
  - Tailwind colours: `paper paper-2 binding ink muted faint ring rule rule-2 accent cell-green cell-yellow yellow-ink cell-red score-0..4`.
  - Fonts: `font-sans`, `font-serif`, `font-mono`.
  - CSS classes: `binding`, `perforated`, `sheet-edges`, `hatched`, `stamp`.
  - Animation: `animate-stamp`.
  - From `lib/ui.ts`: `eyebrow`, `pageTitle`, `meta`, `section`, `underlineInput`, `inkButton`, `outlineButton`, `textButton`, `iconButton`.
  - Deprecated aliases that Task 10 deletes: `card`, `chip`, `cardTitle`, `inputClass`, `primaryButton`, `secondaryButton`, `pillButton`, `emptyAction`.
  - Legacy colour aliases, also deleted in Task 10: `bg card surface line fg dim urgent outline cell-grey`, and `font-display`.

- [ ] **Step 1: Write the failing contrast test** in `web/src/lib/palette.test.ts`

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

function token(name: string): string {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, 'i'))
  if (!match) throw new Error(`missing --color-${name}`)
  return match[1]
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('palette', () => {
  it.each([
    ['ink', 'paper', 4.5], ['ink', 'paper-2', 4.5], ['muted', 'paper', 4.5], ['muted', 'paper-2', 4.5],
    ['accent', 'paper', 4.5], ['accent', 'paper-2', 4.5], ['cell-green', 'paper', 4.5], ['yellow-ink', 'paper', 4.5],
    ['cell-red', 'paper', 4.5], ['paper', 'cell-green', 4.5], ['paper', 'ink', 4.5], ['paper-2', 'binding', 4.5],
    ['ring', 'paper', 3],
  ])('%s on %s is at least %s:1', (fg, bg, min) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(min)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails.** Run `npx vitest run src/lib/palette.test.ts`. Expected: FAIL with `missing --color-paper`.

- [ ] **Step 3: Install the fonts and remove the old ones.**

```bash
npm install @fontsource/instrument-serif@^5.3.0 @fontsource/ibm-plex-sans@^5.3.0 @fontsource/ibm-plex-mono@^5.3.0
npm uninstall @fontsource/inter @fontsource/geist
```

In `web/src/main.tsx`, replace the six `@fontsource/inter` / `@fontsource/geist` imports with:

```ts
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
```

(If `400-italic.css` doesn't exist in the installed package, run `ls node_modules/@fontsource/instrument-serif` and use the italic file it does have.)

- [ ] **Step 4: Replace `web/src/index.css`** with:

```css
@import "tailwindcss";

/* Calendar pad (light only). See docs/superpowers/specs/2026-11-25-calendar-pad-redesign-design.md */
@theme {
  --color-paper: #f7f3ea;
  --color-paper-2: #e9e2d4;
  --color-binding: #2c2a27;
  --color-ink: #1d1b18;
  --color-muted: #665e53;
  /* Decorative only (future circles, dashed dividers): never text */
  --color-faint: #a89f8f;
  /* Open-today circles: ≥ 3:1 on paper */
  --color-ring: #857d70;
  --color-rule: #e3dbcb;
  --color-rule-2: #d6ccb9;
  --color-accent: #b0361f;
  --color-cell-green: #1a7a43;
  /* Minimum fill (graphics only); text and outlines use yellow-ink */
  --color-cell-yellow: #c08a00;
  --color-yellow-ink: #8a6200;
  --color-cell-red: #c4391f;
  /* Month daily-score scale, red → green */
  --color-score-0: #c4391f;
  --color-score-1: #d9761a;
  --color-score-2: #c08a00;
  --color-score-3: #7a9a2a;
  --color-score-4: #1a7a43;

  /* Legacy names mapped onto the pad until each screen is restyled; Task 10 deletes them. */
  --color-bg: #f7f3ea;
  --color-card: #f7f3ea;
  --color-surface: #efe8da;
  --color-line: #e3dbcb;
  --color-fg: #1d1b18;
  --color-dim: #665e53;
  --color-urgent: #b0361f;
  --color-outline: #d6ccb9;
  --color-cell-grey: #e3dbcb;
  --font-display: 'Instrument Serif', Georgia, serif;
  --animate-pop: pop 320ms cubic-bezier(0.22, 1, 0.36, 1);

  --font-sans: 'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-serif: 'Instrument Serif', Georgia, 'Times New Roman', serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  --animate-stamp: stamp 240ms cubic-bezier(0.2, 0.9, 0.3, 1.25) both;

  @keyframes stamp {
    0% { opacity: 0; transform: scale(1.18); }
    55% { opacity: 1; }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes pop {
    0% { transform: scale(1); }
    40% { transform: scale(1.08); }
    100% { transform: scale(1); }
  }
}

:root {
  color-scheme: light;
}

body {
  background-color: var(--color-paper-2);
  color: var(--color-ink);
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  font-variant-numeric: tabular-nums;
}

:focus-visible {
  outline: 2px solid var(--color-ink);
  outline-offset: 2px;
}

@layer components {
  /* The pad's dark binding with a row of punched holes along its lower edge */
  .binding {
    background-color: var(--color-binding);
    background-image: radial-gradient(circle, var(--color-paper-2) 0 3.5px, transparent 4px);
    background-size: 22px 10px;
    background-repeat: repeat-x;
    background-position: 11px calc(100% - 9px);
  }
  /* Torn-off top edge of a sheet */
  .perforated {
    background-image: radial-gradient(circle at 5px 0, var(--color-binding) 2.5px, transparent 3px);
    background-size: 10px 6px;
    background-repeat: repeat-x;
    background-position: 0 0;
  }
  /* Stacked sheets under the current one */
  .sheet-edges {
    box-shadow: 0 2px 0 #ddd5c4, 0 4px 0 #f1ebdf, 0 6px 0 #d8cfbe, 0 8px 0 #efe8da, 0 10px 0 #d3c9b6;
  }
  /* Unmarked share in the distribution bar; paused periods */
  .hatched {
    background: repeating-linear-gradient(45deg, var(--color-rule-2) 0 3px, transparent 3px 6px);
  }
  /* Double-bordered rubber stamp; colour comes from `color` */
  .stamp {
    border: 2.5px solid currentColor;
    border-radius: 6px;
    box-shadow: inset 0 0 0 2px var(--color-paper), inset 0 0 0 3.5px currentColor;
  }
}

/* PAUSED cells (legacy, removed in Task 10 with its last user) */
.cell-paused {
  background: repeating-linear-gradient(135deg, var(--color-rule-2) 0 3px, transparent 3px 6px);
}

/* Legacy logo tile, removed in Task 2 */
.logo-tile {
  background: var(--color-binding);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Our own pull to refresh replaces Chrome's pull-to-reload on phones. Matches MOBILE_QUERY. */
@media (max-width: 767.98px) {
  html {
    overscroll-behavior-y: contain;
  }
}
```

(The old global `h1, h2, h3 { font-family: display; font-weight: 600 }` rule is removed on purpose. Headings now take their face from classes, and Tailwind's preflight resets their size and weight.)

- [ ] **Step 5: Replace `web/src/lib/ui.ts`** with:

```ts
/** Shared Tailwind class strings for the calendar pad (tokens in index.css). No cards: sections are ruled. */
export const eyebrow = 'text-[11px] font-semibold tracking-[0.22em] text-accent uppercase'
export const pageTitle = 'font-serif text-[40px] leading-[1.05] tracking-[-0.01em] text-ink'
export const meta = 'font-mono text-[12px] text-muted'
/** A ruled section below the previous one. */
export const section = 'mt-7 border-t border-rule-2 pt-5'
export const underlineInput =
  'w-full rounded-none border-0 border-b border-rule-2 bg-transparent px-0 py-2.5 text-[16px] text-ink placeholder:text-muted focus:border-ink focus:outline-none'
export const inkButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-ink px-5 text-[15px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-50'
export const outlineButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-ink px-5 text-[15px] font-medium text-ink disabled:opacity-50'
export const textButton =
  'inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-ink underline decoration-rule-2 decoration-2 underline-offset-[6px] hover:decoration-ink disabled:opacity-50'
export const iconButton =
  'flex h-11 w-11 flex-none items-center justify-center rounded-full text-ink transition-colors hover:bg-paper-2 active:bg-paper-2 disabled:opacity-40'

/** @deprecated Removed in Task 10; use the helpers above. */
export const card = 'border-t border-rule-2 py-5'
/** @deprecated */
export const chip = 'inline-flex items-center gap-1.5 font-mono text-[12px]'
/** @deprecated */
export const cardTitle = `mb-3 block ${eyebrow}`
/** @deprecated */
export const inputClass = underlineInput
/** @deprecated */
export const primaryButton = inkButton
/** @deprecated */
export const secondaryButton = outlineButton
/** @deprecated */
export const pillButton = textButton
/** @deprecated */
export const emptyAction = inkButton
```

- [ ] **Step 6: Run the full checks.** Run `npx vitest run && npm run lint && npm run build`. Expected: everything passes, including `palette.test.ts`. Other tests only assert class names such as `bg-cell-green` and `rounded-card`, which are unchanged in this task.

- [ ] **Step 7: Commit**

```bash
git add web/package.json web/package-lock.json web/src/main.tsx web/src/index.css web/src/lib/ui.ts web/src/lib/palette.test.ts
git commit -m "feat(web): calendar pad tokens, fonts and shared classes

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Shell chrome, No Reds rename and app icon

**Files:**
- Modify: `web/src/app/Shell.tsx`, `web/src/app/tabs.ts`, `web/src/app/Logo.tsx`, `web/src/index.css` (delete `.logo-tile`), `web/index.html`, `web/public/manifest.webmanifest`, `web/src/api/errors.ts`, `web/src/api/errors.test.ts`, `web/src/app/router.test.tsx`
- Delete: `web/src/app/TabIcons.tsx`
- Create: `web/icons/icon.svg`, `web/icons/icon-small.svg`, `web/scripts/render-icons.mjs`
- Regenerate: `web/public/favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`

**Interfaces:**
- Consumes: Task 1 tokens and the `binding`, `perforated` and `sheet-edges` classes.
- Produces:
  - `Logo({ size?: 'md' | 'lg' })`: the icon plus the serif "No Reds" wordmark, which inherits the current text colour.
  - `TABS` entries become `{ to, label, end }` (no `icon`), with the labels `Today`, `Progress`, `Habits`, `Me`.

- [ ] **Step 1: Update the tests first.** In `web/src/app/router.test.tsx`, change the tab-name list to `['Today', 'Progress', 'Habits', 'Me']`. In `web/src/api/errors.test.ts`, change the expected message to `"Couldn't reach No Reds. Check your connection and try again."`. Run `npx vitest run src/app/router.test.tsx src/api/errors.test.ts`. Expected: FAIL for both.

- [ ] **Step 2: Rename.**
  - `web/src/api/errors.ts`: `const OFFLINE_MESSAGE = "Couldn't reach No Reds. Check your connection and try again."`
  - `web/index.html`: set `<title>No Reds</title>` and `<meta name="theme-color" content="#2c2a27" />`.
  - `web/public/manifest.webmanifest`: set `"name": "No Reds"`, `"short_name": "No Reds"`, `"theme_color": "#2c2a27"` and `"background_color": "#f7f3ea"`.
  - Run `grep -rn "Chronos" web/src web/index.html web/public web/e2e`. Expected: no user-visible matches remain (code comments are fine).

- [ ] **Step 3: Tabs.** Replace `web/src/app/tabs.ts` with the following, then delete `web/src/app/TabIcons.tsx` and run `grep -rn "TabIcons\|\.icon\b" web/src` to confirm nothing else uses them.

```ts
export interface Tab { to: string; label: string; end: boolean }

/** Order of the top nav, the tab bar, and tab swipes. */
export const TABS: readonly Tab[] = [
  { to: '/', label: 'Today', end: true },
  { to: '/progress', label: 'Progress', end: false },
  { to: '/habits', label: 'Habits', end: false },
  { to: '/settings', label: 'Me', end: false },
]

/** −1 when the path isn't a tab. */
export function tabIndex(pathname: string): number {
  return TABS.findIndex((tab) => tab.to === pathname)
}
```

- [ ] **Step 4: Icons.** Copy the approved artwork:

```bash
mkdir -p web/icons web/scripts
cp "$HOME/Docspace/Chronos/Design Directions/source/icon-a.svg" web/icons/icon.svg
cp "$HOME/Docspace/Chronos/Design Directions/source/icon-a-small.svg" web/icons/icon-small.svg
cp web/icons/icon-small.svg web/public/favicon.svg
```

Create `web/scripts/render-icons.mjs`:

```js
// Renders the PNG app icons in public/ from icons/icon.svg. Run: node scripts/render-icons.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const svg = readFileSync(new URL('../icons/icon.svg', import.meta.url))
const src = `data:image/svg+xml;base64,${svg.toString('base64')}`
// [file, size, share of the canvas the artwork fills]; maskable keeps it inside the 80% safe zone.
const jobs = [['apple-touch-icon.png', 180, 1], ['icon-192.png', 192, 1], ['icon-512.png', 512, 1], ['icon-maskable-512.png', 512, 0.8]]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const [file, size, share] of jobs) {
  const inner = Math.round(size * share)
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:#f7f3ea">
    <img src="${src}" width="${inner}" height="${inner}"></body>`)
  await page.locator('img').evaluate((img) => img.decode())
  await page.screenshot({ path: fileURLToPath(new URL(`../public/${file}`, import.meta.url)) })
}
await browser.close()
```

Run `node scripts/render-icons.mjs`, then `file public/*.png`. Expected: 180×180, 192×192, 512×512 and 512×512 PNGs.

- [ ] **Step 5: Logo.** Replace `web/src/app/Logo.tsx`, and delete the `.logo-tile` block from `index.css`:

```tsx
/** App icon plus the serif "No Reds" wordmark; the wordmark takes the surrounding text colour. */
export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const large = size === 'lg'
  return (
    <span className="flex items-center gap-3">
      <img src="/favicon.svg" alt="" className={`block flex-none ${large ? 'h-12 w-12 rounded-[12px]' : 'h-7 w-7 rounded-[7px]'}`} />
      <span className={`font-serif leading-none ${large ? 'text-[32px]' : 'text-[22px]'}`}>No Reds</span>
    </span>
  )
}

export default Logo
```

- [ ] **Step 6: Shell.** Replace `web/src/app/Shell.tsx` with:

```tsx
import { NavLink } from 'react-router'
import { Logo } from './Logo'
import { SwipeTabs } from './SwipeTabs'
import { TABS } from './tabs'
import { WakingNotice } from './WakingNotice'
import { SyncToast } from './SyncToast'

function topTabClass({ isActive }: { isActive: boolean }): string {
  return `flex h-full items-center border-b-2 text-[14px] font-semibold transition-colors ${
    isActive ? 'border-accent text-paper' : 'border-transparent text-paper/65 hover:text-paper'
  }`
}

/**
 * The pad: a dark binding on top (wordmark and tabs on desktop, punched holes on phones), one paper sheet below,
 * and on phones a text tab bar at the bottom. Logout lives on Me.
 */
export function Shell() {
  return (
    <div className="min-h-screen bg-paper-2 text-ink">
      <header className="binding sticky top-0 z-10 pt-[env(safe-area-inset-top)] md:bg-none">
        <div className="mx-auto flex h-9 max-w-[1080px] items-center px-6 md:h-14 md:px-10">
          <span className="hidden text-paper md:block"><Logo /></span>
          <nav aria-label="Primary" className="ml-auto hidden h-full gap-8 md:flex">
            {TABS.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={topTabClass}>{label}</NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="perforated sheet-edges mx-auto w-full max-w-[1080px] bg-paper px-6 pt-7 pb-[calc(5.5rem+env(safe-area-inset-bottom))] max-md:flex max-md:min-h-[calc(100dvh-2.25rem)] max-md:flex-col md:mb-10 md:px-10 md:pt-10 md:pb-12">
        <SwipeTabs />
      </main>
      <WakingNotice />
      <SyncToast />
      <nav aria-label="Tabs"
        className="fixed inset-x-0 bottom-0 z-10 flex h-[calc(3.75rem+env(safe-area-inset-bottom))] border-t border-rule-2 bg-paper-2 pb-[env(safe-area-inset-bottom)] md:hidden">
        {TABS.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end} className="flex flex-1 items-center justify-center">
            {({ isActive }) => (
              <span className={`border-b-2 pb-1 text-[13px] font-semibold ${isActive ? 'border-accent text-ink' : 'border-transparent text-muted'}`}>
                {label}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default Shell
```

- [ ] **Step 7: Run the full checks.** Run `npx vitest run && npm run lint && npm run build`. Expected: PASS. If `SwipeTabs.test.tsx` or another test looks up the tab link named `Account`, change it to `Me` (test descriptions such as "a left swipe on Account" can stay).

- [ ] **Step 8: Commit**

```bash
git add -A web/src web/icons web/scripts web/public web/index.html
git commit -m "feat(web): pad shell, text tabs, No Reds name and icon

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Shape primitives (`Mark`, `markKind`, `brightness`)

**Files:**
- Create: `web/src/app/Mark.tsx`, `web/src/lib/brightness.ts`, `web/src/lib/brightness.test.ts`
- Modify: `web/src/lib/cells.ts`; create `web/src/lib/cells.test.ts` if it doesn't exist

**Interfaces:**
- Produces:
  - `type MarkKind = 'GREEN' | 'YELLOW' | 'RED' | 'OPEN' | 'FUTURE' | 'PAUSED'` (exported from `lib/cells.ts`).
  - `markKind(state: CellState, future: boolean): MarkKind | null`.
  - `Mark({ kind, dim?, size? }: { kind: MarkKind; dim?: boolean; size?: number })`: an `aria-hidden` SVG with `data-mark={kind}`, plus `data-dim` when dim.
  - `brightness(states: readonly CellState[]): boolean[]`.

- [ ] **Step 1: Write the failing tests.**

`web/src/lib/brightness.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { brightness } from './brightness'

describe('brightness', () => {
  it('keeps every mark bright when nothing was missed', () => {
    expect(brightness(['GREEN', 'YELLOW', 'PENDING'])).toEqual([true, true, true])
  })
  it('dims marks before the last miss and keeps the miss itself bright', () => {
    expect(brightness(['GREEN', 'RED', 'GREEN', 'YELLOW'])).toEqual([false, true, true, true])
    expect(brightness(['GREEN', 'RED', 'GREEN', 'RED', 'GREEN'])).toEqual([false, false, false, true, true])
  })
})
```

Add to the cells test file (`web/src/lib/cells.test.ts`):

```ts
import { describe, expect, it } from 'vitest'
import { markKind } from './cells'

describe('markKind', () => {
  it('shows colours as themselves and unmarked periods as open or future rings', () => {
    expect(markKind('GREEN', false)).toBe('GREEN')
    expect(markKind('RED', true)).toBe('RED')
    expect(markKind('PENDING', false)).toBe('OPEN')
    expect(markKind('PENDING', true)).toBe('FUTURE')
    expect(markKind('GREY', false)).toBe('OPEN')
    expect(markKind('PAUSED', false)).toBe('PAUSED')
    expect(markKind('NOT_DUE', false)).toBeNull()
  })
})
```

Run `npx vitest run src/lib/brightness.test.ts src/lib/cells.test.ts`. Expected: FAIL (modules or exports missing).

- [ ] **Step 2: Implement.**

`web/src/lib/brightness.ts`:

```ts
import type { CellState } from '../api/types'

/** Bright = in the current run: everything after the row's last miss (and the miss itself). Earlier marks are dim. */
export function brightness(states: readonly CellState[]): boolean[] {
  const lastRed = states.lastIndexOf('RED')
  return states.map((state, i) => state === 'RED' || i > lastRed)
}
```

Append to `web/src/lib/cells.ts`:

```ts
export type MarkKind = 'GREEN' | 'YELLOW' | 'RED' | 'OPEN' | 'FUTURE' | 'PAUSED'

/** The shape for a cell: colours as themselves, unmarked as an open ring (fainter once it's in the future). */
export function markKind(state: CellState, future: boolean): MarkKind | null {
  switch (state) {
    case 'GREEN':
    case 'YELLOW':
    case 'RED':
      return state
    case 'PAUSED':
      return 'PAUSED'
    case 'NOT_DUE':
      return null
    case 'PENDING':
    case 'GREY':
      return future ? 'FUTURE' : 'OPEN'
  }
}
```

`web/src/app/Mark.tsx`:

```tsx
import type { MarkKind } from '../lib/cells'

/** One state as a shape (● ◐ ✕ ○ –), so state never relies on colour. Decorative: callers carry the label. */
export function Mark({ kind, dim = false, size = 16 }: { kind: MarkKind; dim?: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" data-mark={kind} data-dim={dim ? '' : undefined}
      className={`relative block flex-none ${dim ? 'opacity-30' : ''}`}>
      {kind === 'GREEN' && <circle cx="8" cy="8" r="7.5" className="fill-cell-green" />}
      {kind === 'YELLOW' && (
        <>
          <circle cx="8" cy="8" r="6.7" strokeWidth="1.6" className="fill-paper stroke-yellow-ink" />
          <path d="M8 1.3 A6.7 6.7 0 0 0 8 14.7 Z" className="fill-cell-yellow" />
        </>
      )}
      {kind === 'RED' && (
        <g strokeWidth="2.2" strokeLinecap="round" className="stroke-cell-red">
          <line x1="3" y1="3" x2="13" y2="13" />
          <line x1="13" y1="3" x2="3" y2="13" />
        </g>
      )}
      {kind === 'OPEN' && <circle cx="8" cy="8" r="6.75" strokeWidth="1.5" className="fill-paper stroke-ring" />}
      {kind === 'FUTURE' && <circle cx="8" cy="8" r="6.75" strokeWidth="1.2" className="fill-paper stroke-rule-2" />}
      {kind === 'PAUSED' && <line x1="4" y1="8" x2="12" y2="8" strokeWidth="1.6" strokeLinecap="round" className="stroke-faint" />}
    </svg>
  )
}

export default Mark
```

- [ ] **Step 3: Run the tests.** Run `npx vitest run src/lib && npm run lint`. Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/Mark.tsx web/src/lib/brightness.ts web/src/lib/brightness.test.ts web/src/lib/cells.ts web/src/lib/cells.test.ts
git commit -m "feat(web): mark shapes and bright/dim rule

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Today: header, ruled rows, stamps and streak lines

**Files:**
- Create: `web/src/features/today/streakText.ts`, `streakText.test.ts`, `Stamp.tsx`
- Modify: `web/src/features/today/habitBits.tsx`, `HabitCard.tsx`, `TodayPage.tsx`, `TodaySummaryView.tsx`, `todaySummary.ts`, `todaySummary.test.ts`, `TodayPage.test.tsx`; `web/src/lib/dates.ts` and its test (`formatWeekday`); `web/src/features/checkin/CellPicker.tsx` (imports only); `web/src/index.css` (delete `--animate-pop` and `@keyframes pop`)

**Interfaces:**
- Consumes: `Mark` and `markKind` (Task 3), plus `eyebrow` and `pageTitle` (Task 1).
- Produces:
  - `streakText(frequency: Frequency, streak: number): { count: number | null; rest: string }`.
  - `StreakLine({ habit, cell, streak, now })`. It replaces `StreakBadge`, `TimeLeftChip` and `WeekPills`, which are deleted. The time-left span keeps its `data-tone` attribute (`normal | urgent`).
  - `Stamp({ color, pressed, onDone })`.
  - `formatWeekday(iso: string): string`, e.g. `'Wednesday'`.

Behaviour (from the spec):
- GREEN **and YELLOW** rows collapse into stamped rows under "Done".
- The streak line reads:
  - DAILY: "N days unbroken" ("1 day unbroken");
  - WEEKLY: "N weeks unbroken";
  - EVERY_N_DAYS: "N in a row";
  - 0: "Fresh start".
- Time left is shown on open rows only: always for non-daily habits, and for daily habits only when urgent. Urgent time left is `text-accent`.

- [ ] **Step 1: Write the failing unit tests.**

`web/src/features/today/streakText.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { streakText } from './streakText'

describe('streakText', () => {
  it('names the unit for daily and weekly habits', () => {
    expect(streakText('DAILY', 12)).toEqual({ count: 12, rest: 'days unbroken' })
    expect(streakText('DAILY', 1)).toEqual({ count: 1, rest: 'day unbroken' })
    expect(streakText('WEEKLY', 6)).toEqual({ count: 6, rest: 'weeks unbroken' })
    expect(streakText('WEEKLY', 1)).toEqual({ count: 1, rest: 'week unbroken' })
  })
  it('counts every-N-days periods in a row', () => {
    expect(streakText('EVERY_N_DAYS', 4)).toEqual({ count: 4, rest: 'in a row' })
  })
  it('calls a zero streak a fresh start', () => {
    expect(streakText('DAILY', 0)).toEqual({ count: null, rest: 'Fresh start' })
  })
})
```

In the existing dates test file (create `web/src/lib/dates.test.ts` if there isn't one), add:

```ts
import { formatWeekday } from './dates'
it('formats the weekday in full', () => {
  expect(formatWeekday('2026-11-25')).toBe('Wednesday')
})
```

In `todaySummary.test.ts`, change the expected `'Go green'` to `'Aim for target'` and `'All green'` to `'All on target'`.

Run `npx vitest run src/features/today/streakText.test.ts src/lib src/features/today/todaySummary.test.ts`. Expected: FAIL.

- [ ] **Step 2: Implement the helpers.**

`web/src/features/today/streakText.ts`:

```ts
import type { Frequency } from '../../api/types'

/** The streak line's words: "12 days unbroken", "6 weeks unbroken", "4 in a row", or "Fresh start". */
export function streakText(frequency: Frequency, streak: number): { count: number | null; rest: string } {
  if (streak <= 0) return { count: null, rest: 'Fresh start' }
  if (frequency === 'EVERY_N_DAYS') return { count: streak, rest: 'in a row' }
  const unit = frequency === 'DAILY' ? 'day' : 'week'
  return { count: streak, rest: `${unit}${streak === 1 ? '' : 's'} unbroken` }
}
```

In `web/src/lib/dates.ts`, add the following next to `formatLongDay`, using the same UTC-safe parsing that `formatLongDay` uses:

```ts
export function formatWeekday(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
}
```

In `todaySummary.ts`, change `say('All green', …)` to `say('All on target', …)` and `say('Go green', …)` to `say('Aim for target', …)`. Keep the rest of each call as it is.

- [ ] **Step 3: Replace `habitBits.tsx`** with the streak line:

```tsx
import type { WeekCell, WeekHabit } from '../../api/types'
import { isColor } from '../../lib/cells'
import { formatTimeLeft, isUrgent } from '../../lib/timeLeft'
import { streakText } from './streakText'

/**
 * Mono line under a habit's name: its streak, then (open periods only) the time left; daily habits show time left
 * only once it's urgent, since the header carries the day's countdown.
 */
export function StreakLine({ habit, cell, streak, now }: { habit: WeekHabit; cell: WeekCell; streak: number | undefined; now: Date }) {
  const left = cell.closesAt && !isColor(cell.state) ? formatTimeLeft(cell.closesAt, now, habit.frequency) : null
  const urgent = left !== null && cell.closesAt !== null && isUrgent(cell.closesAt, now)
  const showLeft = left !== null && (habit.frequency !== 'DAILY' || urgent)
  const text = streak === undefined ? null : streakText(habit.frequency, streak)
  if (!text && !showLeft) return null
  return (
    <p className="mt-1 font-mono text-[12px] text-muted">
      {text && (
        <>
          {text.count !== null && (
            <><span className="sr-only">Current streak </span><b className="font-medium text-ink">{text.count}</b>{' '}</>
          )}
          {text.rest}
        </>
      )}
      {showLeft && (
        <>
          {text && ' · '}
          <span data-tone={urgent ? 'urgent' : 'normal'} className={urgent ? 'text-accent' : undefined}>{left}</span>
        </>
      )}
    </p>
  )
}
```

In `CellPicker.tsx`, replace the `StreakBadge`, `TimeLeftChip` and `WeekPills` import and their row (the `div` with `mt-3 mb-4 flex min-h-6`) with `<StreakLine habit={habit} cell={cell} streak={streak} now={now} />`. Task 10 restyles the rest of the picker.

- [ ] **Step 4: Stamp.** Create `web/src/features/today/Stamp.tsx`:

```tsx
import { Mark } from '../../app/Mark'

/** The rubber stamp on a marked row; `pressed` plays the stamp-press once (none under reduced motion). */
export function Stamp({ color, pressed, onDone }: { color: 'GREEN' | 'YELLOW'; pressed: boolean; onDone(): void }) {
  const green = color === 'GREEN'
  return (
    <span aria-hidden="true" data-stamp={pressed ? '' : undefined} onAnimationEnd={onDone}
      className={`stamp inline-flex flex-none items-center gap-2 px-2.5 py-1.5 font-mono text-[13px] font-medium tracking-[0.14em] data-stamp:animate-stamp ${
        green ? '-rotate-[7deg] text-cell-green' : 'rotate-[5deg] text-yellow-ink'
      }`}>
      <Mark kind={color} size={11} />
      {green ? 'TARGET' : 'MINIMUM'}
    </span>
  )
}

export default Stamp
```

- [ ] **Step 5: Replace `HabitCard.tsx`.** Keep the existing imports for `messageFor`, `hapticMark`, `useSaveCheckIn`, `STATE_LABEL`, `isColor`, `NotebookPen` and the React hooks. Remove the `card`/`chip`/`cellClass` imports, `frequencyChip`, and the habitBits imports apart from `StreakLine`.

```tsx
const BUTTONS: { color: Color; label: string }[] = [
  { color: 'GREEN', label: 'Target' },
  { color: 'YELLOW', label: 'Minimum' },
  { color: 'RED', label: 'Missed' },
]

function NotePreview({ note }: { note: string }) {
  return (
    <p className="mt-1 flex items-center gap-1 text-[12px] text-muted">
      <NotebookPen size={12} className="flex-none" aria-hidden="true" />
      <span className="truncate">{note}</span>
    </p>
  )
}

/**
 * One habit on Today as a ruled row. Open: one-tap Target / Minimum / Missed. Target or Minimum: a stamped row that
 * opens the picker. Both share the <article> root so the node (and this state) survives the switch.
 */
export function HabitCard({ habit, cell, streak, now, yellowLimit, onOpen }: HabitCardProps) {
  const saveCheckIn = useSaveCheckIn()
  const titleId = useId()
  const [error, setError] = useState<string | null>(null)
  const [popped, setPopped] = useState<Color | null>(null)
  const [missedJustNow, setMissedJustNow] = useState(false)
  const articleRef = useRef<HTMLElement>(null)
  const rowButtonRef = useRef<HTMLButtonElement>(null)
  const stamped = cell.state === 'GREEN' || cell.state === 'YELLOW'
  const yellowResets = yellowLimit !== undefined && cell.state !== 'YELLOW'
  const collapsedJustNow = stamped && popped === cell.state

  // Collapsing unmounts the pressed button; hand focus to the row's button unless it has moved elsewhere.
  useEffect(() => {
    if (!collapsedJustNow) return
    const active = document.activeElement
    if (active === null || active === document.body || articleRef.current?.contains(active)) {
      rowButtonRef.current?.focus()
    }
  }, [collapsedJustNow])

  async function mark(color: Color): Promise<void> {
    if (cell.state === color) return
    setError(null)
    hapticMark(color)
    try {
      await saveCheckIn.mutateAsync({ habitId: habit.id, periodStart: cell.periodStart ?? cell.date, color, note: cell.note })
      // A miss gets a quiet word instead of a stamp.
      setPopped(color === 'RED' ? null : color)
      setMissedJustNow(color === 'RED')
    } catch (err) {
      setError(messageFor(err))
    }
  }

  const streakLine = <StreakLine habit={habit} cell={cell} streak={streak} now={now} />
  const errorLine = error && <p role="alert" className="mt-2 text-sm text-cell-red">{error}</p>
  const name = 'font-serif text-[27px] leading-tight break-words text-ink'

  if (stamped) {
    return (
      <article ref={articleRef} aria-labelledby={titleId} className="relative flex items-center gap-4 border-b border-rule py-4">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className={name}>
            {/* The ::after stretches the tap target over the whole row. */}
            <button ref={rowButtonRef} type="button" aria-haspopup="dialog" onClick={onOpen}
              className="text-left after:absolute after:inset-0">
              {habit.name}
            </button>
          </h2>
          <p className="sr-only">{STATE_LABEL[cell.state]}</p>
          {streakLine}
          {cell.note && <NotePreview note={cell.note} />}
          {errorLine}
        </div>
        <Stamp color={cell.state as 'GREEN' | 'YELLOW'} pressed={popped === cell.state} onDone={() => setPopped(null)} />
      </article>
    )
  }

  return (
    <article ref={articleRef} aria-labelledby={titleId} className="border-b border-rule py-4">
      <h2 id={titleId} className={name}>
        <button type="button" aria-haspopup="dialog" onClick={onOpen}
          className="text-left decoration-rule-2 underline-offset-4 hover:underline">
          {habit.name}
        </button>
      </h2>
      {streakLine}
      <div className="mt-2 grid grid-cols-3">
        {BUTTONS.map(({ color, label }, i) => {
          const pressed = cell.state === color
          const warn = color === 'YELLOW' && yellowResets
          return (
            <button key={color} type="button" aria-pressed={pressed} disabled={saveCheckIn.isPending}
              aria-describedby={warn ? `${titleId}-reset` : undefined}
              onClick={() => void mark(color)}
              className={`flex min-h-11 flex-col items-center justify-center px-1 py-1.5 text-[14px] font-medium text-ink transition-colors active:bg-paper-2 disabled:opacity-60 ${
                i > 0 ? 'border-l border-dashed border-faint' : ''
              } ${pressed ? 'bg-paper-2' : ''}`}>
              <span className="flex items-center gap-2">
                <Mark kind={color} size={12} />
                {label}
              </span>
              {warn && <span className="font-mono text-[11px] leading-tight text-yellow-ink" aria-hidden="true">restarts streak</span>}
            </button>
          )
        })}
      </div>
      {yellowResets && (
        <p id={`${titleId}-reset`} className="sr-only">You've used {yellowLimit} minimums in a row; another restarts the streak.</p>
      )}
      {yellowLimit !== undefined && (
        <p className="mt-1 font-mono text-[12px] text-yellow-ink">{yellowLimit}/{yellowLimit} minimums in a row</p>
      )}
      {missedJustNow && cell.state === 'RED' && (
        <p role="status" className="mt-2 font-mono text-[12px] text-muted">
          That's honest. {habit.frequency === 'DAILY' ? 'Tomorrow' : 'The next one'} is a fresh start.
        </p>
      )}
      {cell.state === 'RED' && cell.note && <NotePreview note={cell.note} />}
      {errorLine}
    </article>
  )
}
```

Delete `--animate-pop` and `@keyframes pop` from `index.css`, then run `grep -rn "animate-pop\|data-pop" web/src`. Expected: only test files match (they're updated in Step 8).

- [ ] **Step 6: Replace `TodaySummaryView.tsx`.** The countdown moves to the header, and the coloured segment bar is replaced by a visually hidden label.

```tsx
import type { Summary } from './todaySummary'

/** Today's progress in words under the date; the rows themselves show state, so the segment bar is screen-reader only. */
export function TodaySummary({ summary }: { summary: Summary }) {
  const { headline, line, tone, label } = summary
  return (
    <section aria-label="Today's progress" className="mt-4 border-b border-rule-2 pb-4">
      <h2 className={`font-serif text-[24px] leading-tight ${tone === 'green' ? 'text-cell-green' : 'text-ink'}`}>{headline}</h2>
      <p className="mt-0.5 text-[14px] text-muted">{line}</p>
      {summary.segments.length > 0 && <span role="img" aria-label={label} className="sr-only" />}
    </section>
  )
}
```

- [ ] **Step 7: Update `TodayPage.tsx`.**
  - Change `isDone` to `(item) => item.cell.state === 'GREEN' || item.cell.state === 'YELLOW'`.
  - Replace `<h1 className={pageTitle}>Today</h1>` and the `formatLongDay` paragraph with:

```tsx
<h1 className="sr-only">Today</h1>
<p className="sr-only">{formatLongDay(data.today)}</p>
<header aria-hidden="true" className="flex items-end justify-between gap-4">
  <div>
    <p className={eyebrow}>{formatWeekday(data.today)}</p>
    <p className="font-serif text-[92px] leading-[0.85] tracking-[-0.02em] text-ink">{dayOfMonth(data.today)}</p>
  </div>
  <div className="pb-2 text-right">
    <p className="text-[14px] text-muted">{formatMonth(data.today.slice(0, 7))}</p>
    {summary.countdown && (
      <p className={`font-mono text-[15px] font-medium ${summary.countdown.urgent ? 'text-accent' : 'text-ink'}`}>
        {summary.countdown.text}
      </p>
    )}
  </div>
</header>
```

  - The countdown and long date must stay available to screen readers. Add `{summary.countdown && <p className="sr-only">{summary.countdown.text}</p>}` right after the long-date `sr-only` paragraph.
  - In the list, change the wrapper `grid grid-cols-1 gap-3 xl:grid-cols-2` to `flex flex-col`. Change the "Done" heading to `<h2 key="done" className="mt-6 text-[11px] font-semibold tracking-[0.22em] text-muted uppercase">Done</h2>`.
  - In the `lg` aside, change `className="hidden lg:flex lg:flex-col lg:gap-4"` to `className="hidden lg:flex lg:flex-col lg:gap-4 lg:border-l lg:border-rule-2 lg:pl-8"`. Remove the `card` wrapper around WeekGrid, keeping its heading as `<h2 className={eyebrow}>This week</h2>`. Task 5 swaps WeekGrid for WeekTiles.
  - Fix the imports (`eyebrow`, `formatWeekday`, `dayOfMonth`, `formatMonth`; drop `card`, `cardTitle` and `pageTitle` if unused).

- [ ] **Step 8: Update `TodayPage.test.tsx`.** Keep every test's intent and change only what the new behaviour requires:
  - Assertions on `data-pop` after marking Target or Minimum now assert `[data-stamp]` inside the article, e.g. `await waitFor(() => expect(stretch.querySelector('[data-stamp]')).not.toBeNull())`. A Minimum tap now collapses the row, so the Minimum button is gone afterwards.
  - The "Missed doesn't pop" assertion becomes `expect(stretch.querySelector('[data-stamp]')).toBeNull()`.
  - `'All green'` becomes `'All on target'`.
  - `chip(dialog)` expecting `data-tone="done"` now expects `chip(dialog)` to be `null`, because marked periods no longer show time left.
  - Add a test: marking **Minimum** collapses the habit into a stamped row under "Done". After the click, `within(article).queryByRole('button', { name: 'Minimum', exact: true })` is null, and the article's heading text appears after the "Done" heading in `getAllByRole('article')` order.
  - Add a test: a daily habit with a streak shows "N days unbroken" (e.g. `expect(read).toHaveTextContent('Current streak 12 days unbroken')`).
  - Any yellow-limit sr-only text expectation becomes `minimums`.

- [ ] **Step 9: Run the full checks.** Run `npx vitest run && npm run lint && npm run build`. Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add -A web/src
git commit -m "feat(web): Today as ruled rows with stamps and streak lines

Target and Minimum both collapse into stamped rows under Done.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Progress week: dots, lines, brackets, bright/dim

**Files:**
- Modify: `web/src/features/progress/ProgressPage.tsx`, `WeekPanel.tsx`, `WeekTiles.tsx`, `WeekCellButton.tsx`, `weekLayout.ts`, `WeekPanel.test.tsx`, `ProgressPage.test.tsx`; `web/src/features/today/TodayPage.tsx` (aside)
- Delete: `web/src/features/progress/WeekGrid.tsx`

**Interfaces:**
- Consumes: `Mark`, `markKind`, `brightness`, `eyebrow`, `pageTitle`, `iconButton`, `textButton`.
- Produces:
  - `WeekTiles({ start, today, habits, onPick })`; the `streakOf` prop is removed.
  - `WeekCellButton({ habit, cell, isToday, onPick, children })`: a transparent, full-width, 44 px tall button that keeps its existing `aria-label`, `aria-current` and `disabled` logic.
  - `ProgressPage` passes a `toggle: ReactNode` prop to `WeekPanel` / `MonthPanel`, so each panel renders headline, toggle and navigation in the mockup order.
  - `frequencyText(habit: WeekHabit): string` in `weekLayout.ts` returns `'daily' | 'weekly' | 'every N days'`; `subtitle` is removed.

- [ ] **Step 1: Update the tests first** (`WeekPanel.test.tsx`):
  - Remove the `toHaveClass('rounded-card')` assertion.
  - The `[data-pill]` assertions become shape assertions. For example: `expect(cell.querySelector('[data-mark]')).toHaveAttribute('data-mark', 'GREEN')`, and the open Piano period `expect(screen.getByRole('button', { name: /^Piano/ }).querySelector('[data-mark]')).toHaveAttribute('data-mark', 'OPEN')`.
  - Add a bright/dim test using the fixture's Read row (GREEN, RED, GREEN…): the first GREEN's mark has `data-dim` and the later GREEN's mark doesn't.
  - Add a headline test: a week with a RED shows the text `This week`; a week fixture with no RED shows `No red this week`.

  Run `npx vitest run src/features/progress`. Expected: FAIL.

- [ ] **Step 2: `weekLayout.ts`.** Replace `subtitle` with:

```ts
export function frequencyText(habit: WeekHabit): string {
  if (habit.frequency === 'WEEKLY') return 'weekly'
  if (habit.frequency === 'EVERY_N_DAYS') return `every ${habit.intervalDays} days`
  return 'daily'
}
```

Update any remaining `subtitle` imports; WeekGrid is deleted in Step 6.

- [ ] **Step 3: `WeekCellButton.tsx`:**

```tsx
import type { ReactNode } from 'react'
import type { WeekCell, WeekHabit } from '../../api/types'
import { STATE_LABEL } from '../../lib/cells'
import { periodLabel } from '../checkin/period'

interface WeekCellButtonProps {
  habit: WeekHabit
  cell: WeekCell
  isToday: boolean
  onPick(habit: WeekHabit, cell: WeekCell): void
  children: ReactNode
}

/** One tappable period: a transparent 44px-tall hit area over its mark. Past uneditable periods can't be tapped. */
export function WeekCellButton({ habit, cell, isToday, onPick, children }: WeekCellButtonProps) {
  return (
    <button type="button" aria-label={`${habit.name}, ${periodLabel(habit, cell)}, ${STATE_LABEL[cell.state]}`}
      aria-current={isToday ? 'date' : undefined} disabled={!cell.editable} onClick={() => onPick(habit, cell)}
      className={`relative z-10 flex h-11 w-full items-center justify-center rounded-full ${cell.editable ? 'cursor-pointer active:bg-paper-2' : ''}`}>
      {children}
    </button>
  )
}

export default WeekCellButton
```

Keep the `periodLabel` import path that the current file uses.

- [ ] **Step 4: Replace `WeekTiles.tsx`:**

```tsx
import type { CellState, WeekCell, WeekHabit } from '../../api/types'
import { Mark } from '../../app/Mark'
import { brightness } from '../../lib/brightness'
import { markKind } from '../../lib/cells'
import { addDays, dayOfMonth, WEEKDAYS } from '../../lib/dates'
import { WeekCellButton } from './WeekCellButton'
import { frequencyText, weekSegments, type Segment } from './weekLayout'

const NAME_COL = '6.5rem'
const GRID = 'grid grid-cols-[6.5rem_repeat(7,minmax(0,1fr))]'
const inRun = (state: CellState | undefined) => state === 'GREEN' || state === 'YELLOW'
const TONE: Partial<Record<CellState, string>> = { GREEN: 'text-cell-green', YELLOW: 'text-cell-yellow', RED: 'text-cell-red' }

interface WeekTilesProps {
  start: string
  today: string
  habits: WeekHabit[]
  onPick(habit: WeekHabit, cell: WeekCell): void
}

/** A period longer than a day: a line with end ticks across it, its dot centred on the same line. */
function Bracket({ state, future, dim }: { state: CellState; future: boolean; dim: boolean }) {
  const tone = TONE[state] ?? (future ? 'text-rule-2' : 'text-ring')
  return (
    <span aria-hidden="true" className={`absolute inset-x-2 top-1/2 h-2.5 -translate-y-1/2 ${tone} ${dim ? 'opacity-30' : TONE[state] ? 'opacity-60' : ''}`}>
      <span className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 bg-current" />
      <span className="absolute inset-y-0 left-0 w-[1.5px] bg-current" />
      <span className="absolute inset-y-0 right-0 w-[1.5px] bg-current" />
    </span>
  )
}

function HabitMarks({ habit, start, today, onPick }: { habit: WeekHabit; start: string; today: string; onPick: WeekTilesProps['onPick'] }) {
  const segments = weekSegments(habit, start)
  const bright = brightness(segments.map((segment) => segment.cell?.state ?? 'NOT_DUE'))
  const daily = habit.frequency === 'DAILY'
  return segments.map(({ col, span, cell, from, to }: Segment, i) => {
    const style = { gridColumn: `${col + 2} / span ${span}` }
    if (!cell) return <span key={col} style={style} aria-hidden="true" />
    const future = from > today
    const kind = markKind(cell.state, future)
    const dim = !bright[i]
    const joined = daily && i > 0 && inRun(segments[i - 1].cell?.state) && inRun(cell.state)
    return (
      <div key={col} style={style} className="relative flex h-14 items-center">
        {joined && (
          <span aria-hidden="true" className={`absolute top-1/2 right-1/2 left-[-50%] h-[1.5px] -translate-y-1/2 ${
            cell.state === 'GREEN' ? 'bg-cell-green' : 'bg-cell-yellow'} ${dim ? 'opacity-30' : 'opacity-60'}`} />
        )}
        {!daily && <Bracket state={cell.state} future={future} dim={dim} />}
        <WeekCellButton habit={habit} cell={cell} isToday={from <= today && today <= to} onPick={onPick}>
          {kind && <Mark kind={kind} dim={dim && kind !== 'RED'} />}
        </WeekCellButton>
      </div>
    )
  })
}

/** Progress week: Monday-first columns, one ruled row per habit with dot marks; today's column is tinted. */
export function WeekTiles({ start, today, habits, onPick }: WeekTilesProps) {
  const todayCol = WEEKDAYS.findIndex((_, i) => addDays(start, i) === today)
  return (
    <div className="relative">
      {todayCol >= 0 && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 rounded-full bg-accent/[0.06]"
          style={{ left: `calc(${NAME_COL} + (100% - ${NAME_COL}) * ${todayCol} / 7)`, width: `calc((100% - ${NAME_COL}) / 7)` }} />
      )}
      {/* Every cell's label already names its day, so the header is visual only. */}
      <div aria-hidden="true" className={`${GRID} pb-2 text-center`}>
        <span />
        {WEEKDAYS.map((weekday, i) => {
          const date = addDays(start, i)
          return (
            <span key={weekday} className="flex flex-col items-center">
              <span className={`text-[10px] font-semibold tracking-[0.14em] ${date === today ? 'text-accent' : 'text-muted'}`}>
                {weekday.charAt(0)}
              </span>
              <span className={`font-serif text-[17px] leading-tight ${date > today ? 'text-faint' : 'text-ink'}`}>{dayOfMonth(date)}</span>
            </span>
          )
        })}
      </div>
      <ul>
        {habits.map((habit) => (
          <li key={habit.id} aria-label={habit.name} className={`${GRID} items-center border-t border-rule`}>
            <div className="min-w-0 py-2 pr-2">
              <h3 className="font-serif text-[20px] leading-tight break-words text-ink">{habit.name}</h3>
              <p className="font-mono text-[11px] text-muted">{frequencyText(habit)}</p>
            </div>
            <HabitMarks habit={habit} start={start} today={today} onPick={onPick} />
          </li>
        ))}
      </ul>
      <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><Mark kind="GREEN" size={10} /> bright: current run</span>
        <span className="flex items-center gap-1.5"><Mark kind="GREEN" size={10} dim /> dim: before the last miss</span>
      </p>
    </div>
  )
}

export default WeekTiles
```

`weekSegments` already exports the `Segment` type. If it doesn't, export the interface.

- [ ] **Step 5: `ProgressPage.tsx` and `WeekPanel.tsx`.**

`ProgressPage.tsx`:

```tsx
import { useSearchParams } from 'react-router'
import { SyncStatus } from '../../app/SyncStatus'
import { eyebrow } from '../../lib/ui'
import { MonthPanel } from './MonthPanel'
import { WeekPanel } from './WeekPanel'

function toggleClass(active: boolean): string {
  return `min-h-11 border-b-2 text-[15px] font-semibold transition-colors ${active ? 'border-accent text-ink' : 'border-transparent text-muted'}`
}

/** Week (default) or Month (`?view=month`); each panel keeps its own `start` / `month` parameter. */
export function ProgressPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const isMonth = searchParams.get('view') === 'month'
  const toggle = (
    <div role="group" aria-label="View" className="mt-3 flex gap-6">
      <button type="button" aria-pressed={!isMonth} className={toggleClass(!isMonth)} onClick={() => setSearchParams({})}>Week</button>
      <button type="button" aria-pressed={isMonth} className={toggleClass(isMonth)} onClick={() => setSearchParams({ view: 'month' })}>Month</button>
    </div>
  )
  return (
    <section className="max-w-3xl">
      <h1 className={eyebrow}>Progress</h1>
      <SyncStatus className="mt-1" />
      {isMonth ? <MonthPanel toggle={toggle} /> : <WeekPanel toggle={toggle} />}
    </section>
  )
}

export default ProgressPage
```

In `WeekPanel.tsx`:
- Add the prop `{ toggle }: { toggle: ReactNode }` and render `{toggle}` in the loading and error branches too, e.g. `<>{toggle}<p className="mt-4 text-muted">…</p></>`.
- Replace the local `iconButton` const with the one from `lib/ui`, and `pillButton` with `textButton`.
- Replace the returned header with:

```tsx
const noRed = data.habits.every((habit) => habit.cells.every((cell) => cell.state !== 'RED'))
const current = !start
const headline = noRed ? `No red ${current ? 'this' : 'that'} week` : current ? 'This week' : 'That week'
…
<p className={`${pageTitle} mt-1`}>{headline}</p>
{toggle}
<div className="mt-4 mb-4 flex items-center gap-1 border-y border-rule-2 py-1">
  <button type="button" aria-label="Previous week" className={iconButton} onClick={() => goTo(addDays(data.start, -7))}>
    <ChevronLeft size={20} aria-hidden="true" />
  </button>
  <h2 className="min-w-0 flex-1 text-center font-serif text-[22px] text-ink">{formatWeekRange(data.start)}</h2>
  <button type="button" aria-label="Next week" className={iconButton} onClick={() => goTo(addDays(data.start, 7))}>
    <ChevronRight size={20} aria-hidden="true" />
  </button>
</div>
{start && <button type="button" className={`${textButton} mb-2`} onClick={() => setSearchParams({})}>This week</button>}
```

- Call `WeekTiles` without `streakOf`.
- Change the EmptyState copy to "Mark your habits each day and this week fills up with targets, minimums and misses."
- Leave the stats grid (`DistributionDonut` + `StreakList`) for Task 6; just change its wrapper to `<div>`.

  `MonthPanel` must accept and render `toggle` too. In this task, add the prop and render `{toggle}` first; Task 7 restyles the rest. Update `ProgressPage.test.tsx` if it relied on the old `h1` text: the `h1` is still named "Progress".

- [ ] **Step 6: Today aside.** In `TodayPage.tsx`, replace `WeekGrid` with `<WeekTiles start={data.start} today={data.today} habits={data.habits} onPick={(habit, cell) => setPicked({ habit, cell })} />` and delete `WeekGrid.tsx`. Then run `grep -rn "WeekGrid\|subtitle(" web/src`. Expected: no matches.

- [ ] **Step 7: Run the full checks.** Run `npx vitest run && npm run lint && npm run build`. Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A web/src
git commit -m "feat(web): Progress week as dot, line and bracket marks with bright/dim

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: Distribution bar and streak list

**Files:**
- Create: `web/src/features/stats/DistributionBar.tsx`
- Delete: `web/src/features/stats/DistributionDonut.tsx`
- Modify: `web/src/features/stats/StreakList.tsx`, `web/src/features/progress/WeekPanel.tsx`, `MonthPanel.tsx`, `WeekPanel.test.tsx`, `MonthPanel.test.tsx`, `web/e2e/habit.spec.ts`

**Interfaces:**
- Produces: `DistributionBar({ title, caption, distribution }: { title: string; caption: string; distribution: Distribution })`, a `section` with `aria-label={title}`. Its list items are named `Target N`, `Minimum N`, `Missed N` and `Unmarked N`. Those names replace `Green N`, `Yellow N`, `Red N` and `Unmarked N`.

- [ ] **Step 1: Update the tests.**
  - Change `listitem` names `'Green N'` to `'Target N'` in `WeekPanel.test.tsx`, `MonthPanel.test.tsx` and `e2e/habit.spec.ts`.
  - Add to `WeekPanel.test.tsx`: the "This week" region shows the % Target, e.g. `expect(within(distribution).getByText('67%')).toBeInTheDocument()` for a fixture with green 2 of total 3. Use the fixture's actual numbers.
  - Add a test that a streak list item with `current: 0` has the class `opacity-45`.

  Run `npx vitest run src/features/progress`. Expected: FAIL.

- [ ] **Step 2: Create `DistributionBar.tsx`:**

```tsx
import type { Distribution } from '../../api/types'
import { Mark } from '../../app/Mark'
import type { MarkKind } from '../../lib/cells'
import { eyebrow } from '../../lib/ui'

const PARTS: { key: keyof Omit<Distribution, 'total'>; label: string; kind: MarkKind; bar: string; text: string }[] = [
  { key: 'green', label: 'Target', kind: 'GREEN', bar: 'bg-cell-green', text: 'text-cell-green' },
  { key: 'yellow', label: 'Minimum', kind: 'YELLOW', bar: 'bg-cell-yellow', text: 'text-yellow-ink' },
  { key: 'red', label: 'Missed', kind: 'RED', bar: 'bg-cell-red', text: 'text-cell-red' },
  { key: 'grey', label: 'Unmarked', kind: 'OPEN', bar: 'hatched', text: 'text-muted' },
]

/** % Target as a big numeral, one stacked bar, and a count per shape. */
export function DistributionBar({ title, caption, distribution }: { title: string; caption: string; distribution: Distribution }) {
  const { total } = distribution
  const target = total === 0 ? null : Math.round((distribution.green * 100) / total)
  return (
    <section aria-label={title} className="mt-8 border-t border-rule-2 pt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={eyebrow}>{title}</h2>
        <span className="font-mono text-[12px] text-muted">{caption}</span>
      </div>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="font-serif text-[64px] leading-none text-ink">{target === null ? '–' : `${target}%`}</span>
        <span className="font-serif text-[22px] text-muted italic">target</span>
      </p>
      <div aria-hidden="true" className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-paper-2">
        {PARTS.map(({ key, bar }) => distribution[key] > 0 && <span key={key} className={bar} style={{ flex: distribution[key] }} />)}
      </div>
      {total === 0 && <p className="mt-2 text-[14px] text-muted">Nothing marked yet</p>}
      <ul className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 font-mono text-[13px]">
        {PARTS.map(({ key, label, kind, text }) => (
          <li key={key} aria-label={`${label} ${distribution[key]}`} className={`flex items-center gap-1.5 ${text}`}>
            <Mark kind={kind} size={11} />
            {distribution[key]} {label.toLowerCase()}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default DistributionBar
```

- [ ] **Step 3: Replace the contents of `StreakList.tsx`:**

```tsx
import { eyebrow } from '../../lib/ui'
import { useStreaks } from './api'

/** Current and best streak per habit; a broken run (current 0) is faded. Streaks count Target/Minimum periods. */
export function StreakList() {
  const { data } = useStreaks()
  return (
    <section aria-label="Streaks" className="mt-8 border-t border-rule-2 pt-5">
      <div className="flex items-baseline justify-between">
        <h2 className={eyebrow}>Streaks</h2>
        <span aria-hidden="true" className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Now · best</span>
      </div>
      {data?.length === 0 && <p className="mt-2 text-sm text-muted">No habits yet</p>}
      <ul className="mt-1">
        {data?.map((streak) => (
          <li key={streak.habitId} aria-label={streak.name}
            className={`flex items-baseline gap-3 border-b border-rule py-2.5 ${streak.current === 0 ? 'opacity-45' : ''}`}>
            <span className="min-w-0 flex-1 font-serif text-[22px] leading-tight break-words text-ink">{streak.name}</span>
            <span className="font-serif text-[26px] leading-none text-ink">
              <span className="sr-only">Current streak </span>{streak.current}
            </span>
            <span className="w-16 text-right font-mono text-[12px] text-muted">best {streak.best}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default StreakList
```

- [ ] **Step 4: Wire it up.**
  - In `WeekPanel.tsx`, replace the stats grid with `<DistributionBar title={start ? 'Distribution' : 'This week'} caption={`${data.distribution.total} due${start ? '' : ' so far'}`} distribution={data.distribution} />` followed by `<StreakList />`, both full width.
  - In `MonthPanel.tsx`, replace `DistributionDonut` with `<DistributionBar title="Distribution" caption={`${data.distribution.total} due`} distribution={data.distribution} />`.
  - Delete `DistributionDonut.tsx`.
  - Update any test that reads streak text: `current · best` now renders as separate pieces ("Current streak 12", "best 14").

- [ ] **Step 5: Run the full checks.** Run `npx vitest run && npm run lint && npm run build`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A web/src web/e2e
git commit -m "feat(web): distribution bar and serif streak list

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: Progress month: wall calendar and habit strips

**Files:**
- Modify: `web/src/features/progress/MonthPanel.tsx`, `CalendarGrid.tsx`, `MonthPanel.test.tsx`

**Interfaces:**
- Consumes: `Mark`, `markKind`, `brightness`, `toggle` (Task 5) and `DistributionBar` (Task 6).
- Produces:
  - `scoreClass(score)` keeps its thresholds. It returns `'border-[1.5px] border-faint text-muted'` for null, `bg-score-N/30 text-ink` for steps 0–3, and `'bg-score-4 text-paper'` for step 4.
  - `CalendarGrid({ days })`: the `showNumbers` and `compact` props are removed; numbers are always shown.

- [ ] **Step 1: Update the tests** (`MonthPanel.test.tsx`):
  - The score classes become `bg-score-4`, `bg-score-0/30`, `bg-score-2/30`, `bg-score-3/30` and `bg-score-1/30`; "nothing marked" becomes `border-faint`.
  - Per-habit marks: `getByRole('img', { name: 'Read, Sun 1 Nov, Target hit' })` must contain `[data-mark="GREEN"]`; the Missed one must contain `[data-mark="RED"]`.
  - `'50% green'` becomes `'50% target'`.

  Run the tests and confirm they FAIL.

- [ ] **Step 2: `CalendarGrid.tsx`.** Rewrite `scoreClass` as below and simplify `CalendarGrid`:

```tsx
export function scoreClass(score: number | null): string {
  if (score === null) return 'border-[1.5px] border-faint text-muted'
  if (score < 0.4) return 'bg-score-0/30 text-ink'
  if (score < 0.8) return 'bg-score-1/30 text-ink'
  if (score < 1.2) return 'bg-score-2/30 text-ink'
  if (score < 1.6) return 'bg-score-3/30 text-ink'
  return 'bg-score-4 text-paper'
}

/** One month as a Monday-first wall calendar: a serif numeral on a score-coloured circle. */
export function CalendarGrid({ days }: { days: CalendarDay[] }) {
  const blanks = days.length > 0 ? weekdayIndex(days[0].date) : 0
  return (
    <div className="grid grid-cols-7 gap-y-1.5">
      {WEEKDAYS.map((weekday) => (
        <div key={weekday} aria-hidden="true" className="pb-1 text-center text-[10px] font-semibold tracking-[0.14em] text-muted">
          {weekday.charAt(0)}
        </div>
      ))}
      {Array.from({ length: blanks }, (_, i) => <div key={`blank-${i}`} data-blank />)}
      {days.map((day) => (
        <div key={day.date} role="img" aria-label={day.label}
          className={`mx-auto flex h-[34px] w-[34px] items-center justify-center rounded-full font-serif text-[16px] ${day.className}`}>
          {dayOfMonth(day.date)}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: `MonthPanel.tsx`.**
  - Render `<p className={`${pageTitle} mt-1`}>{formatMonth(data.month).split(' ')[0]}</p>`, then `{toggle}`, then the same ruled navigation row as the week view: `iconButton` arrows, a serif `h2` with `formatMonth(data.month)`, and `textButton` "This month".
  - Rename the share text to `% target`.
  - The body becomes a single column:

```tsx
<section aria-label="Daily score" className="mt-2">
  <h3 className={`${eyebrow} mb-3`}>Daily score</h3>
  <CalendarGrid days={overview} />
  <div aria-hidden="true" className="mt-4 flex items-center gap-2 font-mono text-[11px] text-muted">
    <span>Missed</span>
    <span className="h-2 flex-1 rounded-full bg-linear-to-r from-score-0 via-score-2 to-score-4" />
    <span>Target</span>
    <span className="ml-2 h-3 w-3 flex-none rounded-full border-[1.5px] border-faint" />
    <span>not marked</span>
  </div>
</section>
<DistributionBar title="Distribution" caption={`${data.distribution.total} due`} distribution={data.distribution} />
{data.habits.length > 0 && (
  <section aria-label="By habit" className="mt-8 border-t border-rule-2 pt-5">
    <div className="flex items-baseline justify-between">
      <h2 className={eyebrow}>By habit</h2>
      <span aria-hidden="true" className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">% target</span>
    </div>
    {data.habits.map((habit) => <HabitStrip key={habit.id} habit={habit} />)}
  </section>
)}
```

  with a `HabitStrip` in the same file:

```tsx
/** One dot per day of the month: same shapes and bright/dim rule as the week; PENDING (today/future) is faint. */
function HabitStrip({ habit }: { habit: MonthHabit }) {
  const share = greenShare(habit)
  const bright = brightness(habit.cells.map(({ state }) => state))
  return (
    <section aria-label={habit.name} className="border-b border-rule py-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 font-serif text-[20px] leading-tight break-words text-ink">{habit.name}</h3>
        <span className="flex-none font-mono text-[12px] text-muted">{share === null ? '–' : `${share}% target`}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-[2.5px]">
        {habit.cells.map(({ date, state }, i) => {
          const kind = markKind(state, state === 'PENDING')
          return (
            <span key={date} role="img" aria-label={`${habit.name}, ${formatDay(date)}, ${STATE_LABEL[state]}`}>
              {kind ? <Mark kind={kind} size={8} dim={!bright[i] && kind !== 'RED'} /> : <span className="block h-2 w-2" />}
            </span>
          )
        })}
      </div>
    </section>
  )
}
```

  - Remove the `card`, `cardTitle`, `pillButton` and `cellClass` imports.

- [ ] **Step 4: Run the full checks.** Run `npx vitest run && npm run lint && npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A web/src
git commit -m "feat(web): Progress month wall calendar and habit strips

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 8: Habits page, habit form and the Minimum-limit dialog

**Files:**
- Modify: `web/src/features/habits/HabitsPage.tsx`, `HabitForm.tsx`, `HabitsPage.test.tsx`, `web/src/app/YellowLimitProvider.tsx`, `web/src/features/today/TodayPage.test.tsx`, `web/src/features/progress/WeekPanel.test.tsx`, `web/e2e/habit.spec.ts`

**Interfaces:**
- Consumes: `Mark`, `useStreaks` (`features/stats/api`), `eyebrow`, `pageTitle`, `iconButton`, `inkButton`, `outlineButton`, `underlineInput`.
- Produces copy changes (tests are updated in Step 1):

| Before | After |
|---|---|
| `Bare minimum (YELLOW)` | `Minimum` |
| `Target (GREEN)` | `Target` |
| `Limit yellows in a row` | `Limit minimums in a row` |
| `Yellow limit reached` | `Minimum limit reached` |
| `dt` "Green" / "Yellow" | `dt` "Target" / "Minimum" |

- [ ] **Step 1: Update the tests.**
  - In `HabitsPage.test.tsx`, use the new labels and `dt` text. The `getByText('Target').nextElementSibling` pattern still holds, because the `Mark` sits inside the `dd`.
  - Change the alertdialog name `'Yellow limit reached'` to `'Minimum limit reached'` in `TodayPage.test.tsx` and `WeekPanel.test.tsx`.
  - Change the e2e `getByLabel` calls to `'Minimum'` and `'Target'`. Use `{ exact: true }`, because the checkbox label contains "minimums".
  - Add a test to `HabitsPage.test.tsx`: an active habit row shows its run from streaks, e.g. `toHaveTextContent('31 run')` with a stubbed `/api/stats/streaks` response. Follow how the other tests stub endpoints.

  Run the tests and confirm they FAIL.

- [ ] **Step 2: `HabitForm.tsx`.**
  - Change the form wrapper to `className="mb-6 border-b border-rule-2 pb-6"`.
  - Change labels to `Minimum` and `Target`. Labels use the `eyebrow` style, but `text-muted` instead of `text-accent`: ``const label = 'text-[11px] font-semibold tracking-[0.22em] text-muted uppercase'``.
  - Replace `inputClass` with `underlineInput`. The select keeps `underlineInput` plus `appearance-none bg-[length:12px] pr-6`.
  - The checkbox row loses its box: `className="mb-4 flex items-start gap-3 py-2"`, with the checkbox class `mt-0.5 h-5 w-5 accent-ink`, the text "Limit minimums in a row", and the hint `Up to {me?.maxYellows ?? 2} in a row keep your streak.`
  - Buttons: `inkButton` for submit and `outlineButton` for Cancel.

- [ ] **Step 3: `HabitsPage.tsx`.**
  - Header: `<p className={eyebrow}>Your pad</p><h1 className={pageTitle}>Habits</h1>`.
  - `IconButton` uses the `iconButton` class from `lib/ui`.
  - `Rule` becomes:

```tsx
function Rule({ kind, term, detail }: { kind: 'GREEN' | 'YELLOW'; term: string; detail: string }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="sr-only">{term}</dt>
      <dd className="flex min-w-0 items-center gap-2 text-[14px] break-words text-ink"><Mark kind={kind} size={11} />{detail}</dd>
    </div>
  )
}
```

  - The row becomes a ruled list item:

```tsx
const run = streaks.data?.find((s) => s.habitId === habit.id)?.current
…
<li key={habit.id} aria-label={habit.name}
  className={`flex items-start gap-2 border-b border-rule py-4 ${isArchived || isPaused ? 'opacity-50' : ''}`}>
  <div className="min-w-0 flex-1">
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="font-serif text-[27px] leading-tight break-words text-ink">{habit.name}</h2>
      {isPaused && <span className="stamp -rotate-6 px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-[0.14em] text-accent uppercase">Paused</span>}
    </div>
    <p className="mt-1 font-mono text-[12px] text-muted">
      {frequencyLabel(habit.frequency, habit.intervalDays).toLowerCase()} · since {formatDay(habit.startDate)}
      {!isArchived && run !== undefined && <> · <b className="font-medium text-ink">{run}</b> run</>}
      {habit.yellowCap && ` · ≤${me?.maxYellows ?? 2} minimums`}
    </p>
    <dl className="mt-2 grid gap-1">
      <Rule kind="GREEN" term="Target" detail={habit.targetText} />
      <Rule kind="YELLOW" term="Minimum" detail={habit.minText} />
    </dl>
  </div>
  <div className="flex flex-none">{/* existing IconButtons unchanged */}</div>
</li>
```

  - Change `list` to `'flex flex-col'`.
  - The New-habit button becomes an ink pill that is labelled on every screen size:

```tsx
<button type="button" aria-label="New habit" onClick={() => setCreating(true)}
  className="fixed right-5 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-semibold text-paper shadow-[0_6px_18px_rgb(29_27_24/0.25)] md:static md:h-11 md:shadow-none">
  <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
  New habit
</button>
```

  - The archived `summary` uses `className={`${eyebrow} flex min-h-11 cursor-pointer items-center text-muted`}`.
  - Add `const streaks = useStreaks()` and the `Mark` import; remove the `card` import.

- [ ] **Step 4: `YellowLimitProvider.tsx`.**
  - Copy:
    - title "Minimum limit reached";
    - body "You've hit {hit.limit} minimums in a row on {hit.name}. Next time hit the target, or the streak starts over.";
    - reset note "Fresh start on {hit.name}: that was minimum {hit.limit + 1} in a row, so the streak is back to 1."
  - Style:
    - backdrop `bg-binding/45`, without backdrop blur;
    - dialog `rounded-[12px] border border-rule-2 bg-paper p-6 text-center shadow-[0_20px_50px_rgb(29_27_24/0.25)]`;
    - the swatch becomes `<span className="mx-auto mb-3 block w-fit" aria-hidden="true"><Mark kind="YELLOW" size={36} /></span>`;
    - the title gets `font-serif text-[26px] text-ink`;
    - the reset toast is `rounded-[10px] bg-ink text-paper` with `<Mark kind="YELLOW" size={20} />`, and its OK button is `text-paper underline`.

- [ ] **Step 5: Run the full checks.** Run `npx vitest run && npm run lint && npm run build`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A web/src web/e2e
git commit -m "feat(web): ruled Habits page, Minimum/Target wording

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 9: Me (Account) page with a stepper

**Files:**
- Create: `web/src/app/Stepper.tsx`
- Modify: `web/src/features/account/AccountPage.tsx`, `AccountPage.test.tsx`

**Interfaces:**
- Produces: `Stepper({ value, min, max, labelledBy, onChange }: { value: number; min: number; max: number; labelledBy: string; onChange(next: number): void })`. Its buttons are named "Fewer" and "More", and the value is an `<output aria-live="polite">`.

- [ ] **Step 1: Update the tests.** In `AccountPage.test.tsx`:
  - The streak-rule test now clicks `More` once (2 → 3), then "Save streak rule", and still expects `PUT { maxYellows: 3 }`.
  - Add: `Fewer` is disabled at 1, and `More` is disabled at 7.
  - The label text becomes "Minimums allowed in a row".

  Run the tests and confirm they FAIL.

- [ ] **Step 2: Create `Stepper.tsx`:**

```tsx
const stepButton = 'flex h-11 w-11 items-center justify-center rounded-full border border-ink text-[22px] leading-none text-ink disabled:opacity-30'

/** − value + for a small whole number; the value is announced as it changes. */
export function Stepper({ value, min, max, labelledBy, onChange }: {
  value: number; min: number; max: number; labelledBy: string; onChange(next: number): void
}) {
  return (
    <div className="flex items-center gap-5">
      <button type="button" aria-label="Fewer" disabled={value <= min} onClick={() => onChange(value - 1)} className={stepButton}>−</button>
      <output aria-live="polite" aria-labelledby={labelledBy} className="w-12 text-center font-serif text-[48px] leading-none text-ink">
        {value}
      </output>
      <button type="button" aria-label="More" disabled={value >= max} onClick={() => onChange(value + 1)} className={stepButton}>+</button>
    </div>
  )
}

export default Stepper
```

- [ ] **Step 3: `AccountPage.tsx`.**
  - Change `maxYellows` state to a number: `useState(me?.maxYellows ?? 2)`. The PUT sends `{ maxYellows }`.
  - Header:

```tsx
<h1 className={eyebrow}>Account</h1>
<div className="mt-4 flex items-center gap-4">
  <span aria-hidden="true" className="flex h-14 w-14 flex-none items-center justify-center rounded-full border-2 border-accent font-serif text-[28px] text-accent shadow-[inset_0_0_0_3px_var(--color-paper),inset_0_0_0_4.5px_var(--color-accent)]">
    {me?.username.charAt(0).toUpperCase()}
  </span>
  <div className="min-w-0">
    <p className="truncate font-serif text-[30px] leading-tight text-ink">{me?.username}</p>
    <p className="truncate font-mono text-[12px] text-muted">{me?.timezone} · day ends 00:00</p>
  </div>
</div>
```

  - Each form gets `className={section}`, and its `h2` uses `eyebrow`.
  - Inputs use `underlineInput`, notes use `mt-2 text-[12px] text-muted`, primary buttons `inkButton`, and "Use this device" `outlineButton`.
  - Streak rule:

```tsx
<h2 className={eyebrow}>Streak rule</h2>
<p id="max-yellows-label" className="mt-3 font-serif text-[22px] text-ink">Minimums allowed in a row</p>
<div className="mt-3"><Stepper value={maxYellows} min={1} max={7} labelledBy="max-yellows-label" onChange={setMaxYellows} /></div>
<p className="mt-2 text-[12px] text-muted">For habits with the limit on, one more minimum starts the streak over.</p>
<button type="submit" className={`${inkButton} mt-4`}>Save streak rule</button>
```

  - Log out sits under a dashed rule:

```tsx
<div className="mt-8 border-t border-dashed border-rule-2 pt-5">
  <button type="button" disabled={!online} onClick={…unchanged…}
    className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-accent disabled:opacity-50">
    <span aria-hidden="true">↩</span>Log out
  </button>
  {!online && <p className="mt-1 text-[13px] text-muted">Connect to log out.</p>}
</div>
```

  - The confirmation dialog uses the same styles as Task 8 Step 4: backdrop `bg-binding/45`, a paper dialog, `outlineButton` Cancel and `inkButton` Log out.
  - Remove the `LogOut` import and the deprecated `ui` imports; `FeedbackLine` keeps its roles.

- [ ] **Step 4: Run the full checks.** Run `npx vitest run && npm run lint && npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A web/src
git commit -m "feat(web): Me page as a ruled pad with a minimums stepper

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 10: Remaining surfaces and removing the legacy styles

**Files:**
- Modify: `web/src/features/checkin/CellPicker.tsx`, `web/src/features/auth/{AuthLayout,LoginPage,SignupPage}.tsx`, `web/src/app/{EmptyState,SyncToast,SyncStatus,WakingNotice,PullToRefresh}.tsx`, `web/src/app/SyncStatus.test.tsx`, `web/src/features/progress/WeekPanel.test.tsx`, `web/src/lib/cells.ts`, `web/src/lib/ui.ts`, `web/src/index.css`, `web/e2e/habit.spec.ts`

- [ ] **Step 1: Update the tests.**
  - In `WeekPanel.test.tsx`, picker choices are no longer checked by class. Assert `toHaveAttribute('aria-pressed', 'true')` on the saved choice and `'false'` on the others.
  - In `SyncStatus.test.tsx`, expect `text-[12px]` instead of `text-[13px]`.
  - In `e2e/habit.spec.ts`:
    - drop the `card.locator('[data-tone]')` visibility line, because a daily, non-urgent row shows no time left;
    - change `page.getByRole('img', { name: '1 of 1 marked: 1 target' })` from `toBeVisible()` to `toBeAttached()`.

- [ ] **Step 2: CellPicker.**
  - Backdrop: `bg-binding/45`, without backdrop blur.
  - Sheet: `perforated w-full bg-paper px-6 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] outline-none md:max-w-md md:rounded-[12px] md:pt-7`.
  - Handle: `bg-rule-2`.
  - Title: `font-serif text-[30px] leading-tight text-ink`.
  - Period line: `font-mono text-[12px] text-muted`.
  - Each choice becomes a ruled row:

```tsx
<button key={choice.color} type="button" aria-pressed={saved === choice.color} disabled={busy}
  aria-describedby={warn ? resetId : undefined} onClick={() => save(choice.color)}
  className={`flex min-h-14 w-full items-center gap-3 border-b border-rule px-1 py-3 text-left disabled:opacity-60 ${saved === choice.color ? 'bg-paper-2' : ''}`}>
  <Mark kind={choice.color} size={18} />
  <span className="min-w-0 flex-1 text-[16px] font-semibold text-ink">
    {STATE_LABEL[choice.color]}
    <small className="block font-mono text-[12px] font-normal text-muted">{choice.hint(habit)}</small>
    {warn && <small className="block font-mono text-[11px] leading-tight text-yellow-ink" aria-hidden="true">restarts streak</small>}
  </span>
  {saved === choice.color && <span aria-hidden="true" className="font-mono text-[11px] tracking-[0.14em] text-muted">SAVED</span>}
</button>
```

  - The rows sit in a `border-t border-rule` wrapper, and `CHOICES` drops its `selected` field.
  - The sr-only reset text says "minimums".
  - "+ Add note" becomes `textButton`; the textarea uses `underlineInput`.
  - "Clear" uses `${textButton} text-cell-red`; "Save note" uses `inkButton`.

- [ ] **Step 3: Auth.**
  - Replace `AuthLayout` with:

```tsx
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper-2">
      <div aria-hidden="true" className="binding h-[calc(2.25rem+env(safe-area-inset-top))]" />
      <main className="perforated mx-auto min-h-[calc(100dvh-2.25rem)] max-w-md bg-paper px-6 pt-10 pb-10">
        <span className="text-ink"><Logo size="lg" /></span>
        <h1 className="mt-8 font-serif text-[44px] leading-[1.02] text-ink">Keep it<br />off red.</h1>
        <p className="mt-3 mb-8 text-[15px] leading-normal text-muted">
          Mark each habit Target, Minimum or Missed. Even the minimum keeps the chain alive.
        </p>
        <h2 className="sr-only">{title}</h2>
        {children}
      </main>
    </div>
  )
}
```

  - In `LoginPage` and `SignupPage`: `inputClass` → `underlineInput`; `primaryButton` → `inkButton`; the links become `font-semibold text-accent underline underline-offset-4`; hints use `font-mono text-[11px] text-muted`.
  - In Signup, "(change it later in Account)" becomes "(change it later in Me)".

- [ ] **Step 4: EmptyState, toasts and status.**
  - Replace `EmptyState.tsx` with:

```tsx
import type { ReactNode } from 'react'
import { Mark } from './Mark'

/** A Minimum leading into two Targets: the "keep it off red" idea in one line, as on the app icon. */
function RunArt() {
  return (
    <div aria-hidden="true" className="mx-auto mb-5 flex w-fit items-center">
      <Mark kind="YELLOW" size={20} />
      <span className="h-[1.5px] w-7 bg-cell-yellow opacity-60" />
      <Mark kind="GREEN" size={20} />
      <span className="h-[1.5px] w-7 bg-cell-green opacity-60" />
      <Mark kind="GREEN" size={20} />
    </div>
  )
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action: ReactNode }) {
  return (
    <section aria-label={title} className="my-4 border-y border-rule-2 px-2 py-10 text-center">
      <RunArt />
      <h2 className="font-serif text-[30px] leading-tight text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted">{children}</p>
      <div className="mt-6">{action}</div>
    </section>
  )
}
```

  - Replace each `emptyAction` usage with `inkButton` (TodayPage, HabitsPage, WeekPanel).
  - SyncToast `p`: `max-w-sm truncate rounded-[10px] bg-ink px-4 py-3 text-[14px] text-paper shadow-[0_8px_24px_rgb(29_27_24/0.3)]`.
  - WakingNotice: `rounded-[10px] bg-ink px-4 py-2 font-mono text-[12px] text-paper shadow-[0_8px_24px_rgb(29_27_24/0.3)]`; keep its positioning classes.
  - SyncStatus: `font-mono text-[12px] text-muted`.
  - PullToRefresh indicator: `border border-rule-2 bg-paper text-muted shadow-[0_6px_18px_rgb(29_27_24/0.18)]`; keep its sizing classes.

- [ ] **Step 5: Remove the legacy styles.**
  - Delete the `/** @deprecated */` exports from `lib/ui.ts`.
  - Delete the legacy colour block, `--font-display`, `.cell-paused` and its comment from `index.css`.
  - Delete `cellClass` from `lib/cells.ts` if nothing uses it any more (`grep -rn "cellClass" web/src`).
  - Then run:

```bash
grep -rnE "\b(bg|text|border|divide|ring|ring-offset|from|via|to|accent|fill|stroke)-(bg|card|surface|line|fg|dim|urgent|outline|cell-grey)\b|font-display|cell-paused|rounded-card|rounded-cell|\b(card|chip|cardTitle|inputClass|primaryButton|secondaryButton|pillButton|emptyAction)\b" web/src --include=*.tsx --include=*.ts
```

  Expected: no matches, except local variables that happen to be named `card` (for example `const habitCard`). Replace any real match using this mapping:

| Old | New |
|---|---|
| `bg` / `card` | `paper` |
| `surface` | `paper-2` |
| `line` | `rule` |
| `fg` | `ink` |
| `dim` | `muted` |
| `urgent` | `accent` |
| `outline` | `rule-2` |
| `cell-grey` | `rule` |
| `rounded-card` | removed |

- [ ] **Step 6: Run everything.**

```bash
npx vitest run && npm run lint && npm run build
```

Expected: PASS. Then, with the local API on :8081 and Vite on :5174 running:

```bash
E2E_BASE_URL=http://localhost:5174 npx playwright test && API_PORT=8081 npm run e2e:offline
```

Expected: both suites PASS.

- [ ] **Step 7: Commit**

```bash
git add -A web/src web/e2e
git commit -m "feat(web): pad picker, auth, empty states and toasts; drop legacy tokens

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 11: Visual check against the mockups and DESIGN.md

**Files:**
- Create: `DESIGN.md` (repository root), through the impeccable-documenter agent
- Temporary: `web/s.tmp.mjs` (deleted before committing)

- [ ] **Step 1: Take screenshots of the real app.** Write `web/s.tmp.mjs`. It uses Playwright with `devices['iPhone 13']` and base URL `http://localhost:5174`, and does the following:
  1. Signs up `shot_<timestamp>`.
  2. Creates Read (DAILY), Stretch (DAILY), Run (EVERY_N_DAYS, 2) and Piano (WEEKLY) through "Create your first habit" and then "New habit", with labels Name, Minimum and Target (`exact: true`) and Frequency.
  3. On Today, marks Stretch Target and Run Minimum.
  4. Screenshots Today, Progress (Week), Progress (`?view=month`), Habits and Me as full pages into `/tmp/redesign/real-*.png`.

  Run it with `node s.tmp.mjs`, then delete it.

- [ ] **Step 2: Compare.** View each `real-*.png` next to `~/Docspace/Chronos/Design Directions/E - Calendar pad (combined)/e-*.png`, and fix material differences in spacing, type scale, rules or marks. Also run `<impeccable skill dir>/scripts/impeccable detect --json --changed`, and fix the findings that apply. Re-run Step 1 after fixes, then commit them with `fix(web): match calendar pad mockups`.

- [ ] **Step 3: DESIGN.md.** Dispatch the `impeccable-documenter` agent to write `DESIGN.md` from the shipped code. Point it at the spec, `index.css`, `lib/ui.ts`, `Mark.tsx` and the screenshots. Commit:

```bash
git add DESIGN.md
git commit -m "docs: DESIGN.md for the calendar pad

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

- [ ] **Step 4: Final validation.** Run the full set of checks from Task 10 Step 6 again. Expected: PASS. Then ask the user before merging or pushing to `main`.
