# Swipe between tabs — design

## Goal

On phones, switch between the four tabs with a horizontal swipe that follows the finger, with the neighbouring tab
peeking in, instead of only tapping the bottom tab bar.

## Decisions

- Feel: follows the finger; neighbour page peeks in; snaps on release.
- Progress: a horizontal swipe always switches tabs. The week/month ‹ › arrows stay as they are.
- Approach: a custom gesture hook (no new dependency). Neighbours render only while dragging.

## Behaviour

- **Scope:** mobile only (`< 768px`, where the bottom tab bar shows). Desktop is unchanged.
- **Order:** Today (`/`) ↔ Progress (`/progress`) ↔ Habits (`/habits`) ↔ Account (`/settings`), matching the tab bar.
  Swipe left → next tab, swipe right → previous tab. Only these four routes are swipeable; other routes (e.g. NotFound)
  render as today with no swipe.
- **Direction lock:** nothing happens until the finger has moved 10px. If `|dx| > |dy|` at that point, the gesture is a
  tab swipe and vertical scroll is blocked for the rest of the touch. Otherwise the page scrolls normally and the
  gesture is ignored until the finger lifts.
- **While dragging:** the current page translates with the finger. The neighbour in the drag direction renders
  beside it, aligned to the top of the viewport.
- **Edges:** dragging right on Today or left on Account moves at ⅓ of the finger's distance (rubber band) and always
  snaps back.
- **Release:** commit when `|dx| > 35%` of the viewport width or the release velocity is `> 0.4 px/ms` in the drag
  direction (and a neighbour exists); otherwise snap back. The settle animation is 250 ms, ease-out, on `transform` only.
- **On commit:** navigate to the neighbour's route (a normal push, so Back returns to the previous tab). The tab bar
  updates its active icon, and the new page starts at the top (`scrollTo(0, 0)`).
- **Ignored starts:** the touch starts inside `input`, `textarea`, `select`, `[contenteditable]` or
  `input[type=range]`; a dialog is open; or the touch starts within 16px of the left or right screen edge (reserved
  for the browser's back gesture).
- **Reduced motion:** with `prefers-reduced-motion: reduce`, the page does not follow the finger. A committed swipe
  switches tabs with a 150 ms opacity fade instead of a slide.
- Tapping tabs works exactly as today.

## Architecture

| Unit | Responsibility |
|---|---|
| `web/src/app/tabs.ts` (create) | The single ordered list of tabs: `{ to, label, icon, end }`. Used by `Shell` (sidebar and tab bar) and by swipe. Exports `tabIndex(pathname): number` (−1 if not a tab route). |
| `web/src/app/tabPages.tsx` (create) | Maps each tab path to its page element (`TodayPage`, `ProgressPage`, `HabitsPage`, `AccountPage`), so a neighbour can be drawn while dragging. Kept separate from `tabs.ts` to avoid a circular import with the pages. |
| `web/src/app/useTabSwipe.ts` (create) | Gesture logic. Takes touch events and returns `{ offset, dragging }` plus a decision on release (`'next' \| 'prev' \| 'cancel'`). Pure rules (lock threshold, commit distance/velocity, rubber band, ignored targets) are exported as plain functions for unit tests. No DOM layout. |
| `web/src/app/SwipeTabs.tsx` (create) | Wraps the routed page on mobile. It renders a track holding the current page (via `Outlet`) and, while dragging, the neighbour page from `tabPages`. It applies the transform, runs the settle animation, then navigates and scrolls to the top. It renders a plain `Outlet` on desktop, for non-tab routes, and when the gesture is disabled. |
| `web/src/app/Shell.tsx` (modify) | Uses `tabs.ts` for `NAV`; wraps `<Outlet />` in `<SwipeTabs>`. |
| `YellowLimitProvider.tsx`, `AccountPage.tsx` (modify) | While their dialog is open, set `document.body.dataset.dialogOpen = 'true'` (cleared on close or unmount). Swipe checks this flag. |

- **Touch handling:** `touchstart`/`touchmove`/`touchend`/`touchcancel` listeners on the track. `touchmove` is
  registered with `{ passive: false }` and calls `preventDefault()` only after a horizontal lock, so vertical scrolling
  stays native. During a drag, transforms are written straight to the element through a ref (`requestAnimationFrame`),
  without React state on every move. React state changes only at the start (to mount the neighbour) and the end.
- **Data:** no new data. Neighbour pages read the React Query cache (persisted for offline), so they usually draw
  immediately; otherwise they show their existing "Loading…".
- **Scroll:** the current page keeps the window scroll. The neighbour is `position: absolute`, placed at the current
  `scrollY` so its top lines up with the viewport top. After a commit the window scrolls to 0.

## Testing

- `useTabSwipe` rules: lock (horizontal vs vertical), commit by distance, commit by velocity, cancel when short, rubber
  band at both ends, ignored targets, dialog flag, edge-zone starts.
- `SwipeTabs` (jsdom with simulated touch events): a left swipe on Today navigates to `/progress`; a short drag stays;
  a right swipe on Today stays; no swipe while `data-dialog-open`; non-tab routes render without swipe.
- Playwright (iPhone 13 viewport, existing `e2e` config): a real drag from Today lands on Progress, and the Progress
  tab icon is active.

## Out of scope

- Swiping on desktop or with a trackpad.
- Swiping between weeks or months on Progress.
- Haptics.
