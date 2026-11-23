# Mobile Gestures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On phones, swipe sideways to switch tabs, pull down on Today/Progress to refresh, and swipe the check-in
sheet down to close it.

**Architecture:** One touch hook (`useTabSwipe`) on a track that wraps the routed page decides, after a 10px lock,
whether a touch is a tab swipe (horizontal) or a pull (down, at scroll top). `SwipeTabs` moves the track and draws the
neighbour tab while dragging; `PullToRefresh` shows a chip and refetches active queries. The check-in sheet gets its own
small hook (`useSheetDrag`). Pure rules are plain exported functions so they are unit-tested without the DOM.

**Tech Stack:** React 19, React Router 7 (`react-router`), TanStack Query v5, Tailwind v4, Vitest + Testing Library
(jsdom), Playwright.

Spec: `docs/superpowers/specs/2026-11-24-swipe-tabs-design.md`.

## Global Constraints

- No new dependencies.
- Mobile only: `(max-width: 767.98px)` (Tailwind `md` is 768px). Desktop behaviour is unchanged.
- Tab order: `/` (Today) → `/progress` (Progress) → `/habits` (Habits) → `/settings` (Account).
- Lock after 10px of movement; horizontal if `|dx| > |dy|`.
- Tab swipe commits when `|dx| > 35%` of `window.innerWidth` or release velocity `> 0.4 px/ms` in the drag direction.
- Rubber band at the ends: ⅓ of finger distance, always snaps back.
- Settle 250 ms ease-out on `transform`; reduced motion: 150 ms opacity fade, no follow.
- Ignored starts: inside `input`, `textarea`, `select`, `[contenteditable]`; any `[aria-modal="true"]` in the
  document; within 16px of the left/right screen edge.
- Pull to refresh only on `/` and `/progress`, only when `window.scrollY === 0` at touch start. Pull = `dy × 0.5`,
  capped at 96px; triggers at 64px; spinner at least 400 ms; offline shows "Offline" for 1.2 s and sends no request.
- Sheet: close when `dy > 30%` of sheet height or downward velocity `> 0.4 px/ms`; settle 200 ms.
- Copy rules: curly apostrophes (’), no exclamation marks, red never colours text.
- Validation from `web/`: `npx vitest run && npm run lint && npm run build`. Lint has 2 expected
  `only-export-components` warnings (`SyncStatus.tsx`, `AccountPage.tsx`); add no new warnings.
- Never add `PRODUCT.md` (untracked, repo root) to git.
- Commits end with `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.
- macOS is case-insensitive: never create two files differing only by case.

---

### Task 1: Gesture rules and the `useTabSwipe` hook

**Files:**
- Create: `web/src/app/useTabSwipe.ts`
- Test: `web/src/app/useTabSwipe.test.ts`

**Interfaces:**
- Produces (all exported from `web/src/app/useTabSwipe.ts`):
  - constants `LOCK_PX = 10`, `EDGE_PX = 16`, `COMMIT_RATIO = 0.35`, `COMMIT_VELOCITY = 0.4`, `RUBBER = 1 / 3`,
    `PULL_RATIO = 0.5`, `PULL_MAX = 96`, `PULL_TRIGGER = 64`
  - `type Lock = 'horizontal' | 'vertical'`, `type Decision = 'next' | 'prev' | 'cancel'`,
    `interface Sample { x: number; y: number; t: number }`
  - `swipeClock: { now(): number }` (tests spy on `swipeClock.now`)
  - `lockFor(dx: number, dy: number): Lock | null`
  - `dragOffset(dx: number, index: number, count: number): number`
  - `releaseDecision(dx: number, velocity: number, width: number, index: number, count: number): Decision`
  - `pullDistance(dy: number): number`
  - `startsOnControl(target: EventTarget | null): boolean`
  - `ignoreStart(target: EventTarget | null, x: number, width: number): boolean`
  - `velocityOf(prev: Sample, last: Sample, axis: 'x' | 'y', now: number): number`
  - `interface TabSwipeHandlers { onDrag(dx: number): void; onRelease(dx: number, velocity: number): void; onPull?(dy: number): void; onPullEnd?(dy: number): void }`
  - `useTabSwipe(ref: RefObject<HTMLElement | null>, enabled: boolean, handlers: TabSwipeHandlers): void`

- [ ] **Step 1: Write the failing tests**

`web/src/app/useTabSwipe.test.ts`:

```ts
import { afterEach, describe, expect, test } from 'vitest'
import {
  dragOffset, ignoreStart, lockFor, pullDistance, releaseDecision, startsOnControl, velocityOf,
} from './useTabSwipe'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('lockFor', () => {
  test('waits for 10px of movement', () => {
    expect(lockFor(6, 6)).toBeNull()
  })
  test('locks horizontal when sideways movement wins', () => {
    expect(lockFor(-12, 4)).toBe('horizontal')
  })
  test('locks vertical when vertical movement wins or ties', () => {
    expect(lockFor(3, 12)).toBe('vertical')
    expect(lockFor(8, -8)).toBe('vertical')
  })
})

describe('dragOffset', () => {
  test('follows the finger between tabs', () => {
    expect(dragOffset(-90, 1, 4)).toBe(-90)
    expect(dragOffset(90, 1, 4)).toBe(90)
  })
  test('rubber-bands past the first and last tab', () => {
    expect(dragOffset(90, 0, 4)).toBe(30)
    expect(dragOffset(-90, 3, 4)).toBe(-30)
  })
})

describe('releaseDecision', () => {
  test('commits past 35% of the width', () => {
    expect(releaseDecision(-140, 0, 390, 0, 4)).toBe('next')
    expect(releaseDecision(140, 0, 390, 2, 4)).toBe('prev')
  })
  test('commits on a fast flick in the drag direction', () => {
    expect(releaseDecision(-40, -0.5, 390, 0, 4)).toBe('next')
  })
  test('cancels a short slow drag or a flick against the drag', () => {
    expect(releaseDecision(-100, -0.2, 390, 0, 4)).toBe('cancel')
    expect(releaseDecision(-40, 0.9, 390, 0, 4)).toBe('cancel')
  })
  test('cancels when there is no tab that way', () => {
    expect(releaseDecision(300, 2, 390, 0, 4)).toBe('cancel')
    expect(releaseDecision(-300, -2, 390, 3, 4)).toBe('cancel')
    expect(releaseDecision(0, 0, 390, 1, 4)).toBe('cancel')
  })
})

test('pullDistance halves the pull and caps it at 96px', () => {
  expect(pullDistance(100)).toBe(50)
  expect(pullDistance(-40)).toBe(0)
  expect(pullDistance(400)).toBe(96)
})

describe('ignoreStart', () => {
  test('ignores touches in the 16px edge zones', () => {
    expect(ignoreStart(document.body, 10, 390)).toBe(true)
    expect(ignoreStart(document.body, 380, 390)).toBe(true)
    expect(ignoreStart(document.body, 200, 390)).toBe(false)
  })
  test('ignores touches on form controls and editable text', () => {
    document.body.innerHTML = '<label><span id="s">x</span><input id="i" type="range"></label><div contenteditable="true"><b id="b">y</b></div>'
    expect(ignoreStart(document.getElementById('i'), 200, 390)).toBe(true)
    expect(ignoreStart(document.getElementById('b'), 200, 390)).toBe(true)
    expect(ignoreStart(document.getElementById('s'), 200, 390)).toBe(false)
    expect(startsOnControl(document.getElementById('i'))).toBe(true)
  })
  test('ignores every touch while a modal dialog is open', () => {
    document.body.innerHTML = '<p id="p">x</p><div aria-modal="true"></div>'
    expect(ignoreStart(document.getElementById('p'), 200, 390)).toBe(true)
  })
})

describe('velocityOf', () => {
  test('is the speed between the last two samples', () => {
    expect(velocityOf({ x: 0, y: 0, t: 0 }, { x: -30, y: 10, t: 50 }, 'x', 50)).toBeCloseTo(-0.6)
    expect(velocityOf({ x: 0, y: 0, t: 0 }, { x: -30, y: 10, t: 50 }, 'y', 50)).toBeCloseTo(0.2)
  })
  test('is 0 when the finger paused for over 100ms before lifting', () => {
    expect(velocityOf({ x: 0, y: 0, t: 0 }, { x: -30, y: 0, t: 50 }, 'x', 200)).toBe(0)
  })
  test('is 0 when the samples share a timestamp', () => {
    expect(velocityOf({ x: 0, y: 0, t: 5 }, { x: -30, y: 0, t: 5 }, 'x', 5)).toBe(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `web/`): `npx vitest run src/app/useTabSwipe.test.ts`
Expected: FAIL, cannot resolve `./useTabSwipe`.

- [ ] **Step 3: Implement**

`web/src/app/useTabSwipe.ts`:

```ts
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

export const LOCK_PX = 10
export const EDGE_PX = 16
export const COMMIT_RATIO = 0.35
export const COMMIT_VELOCITY = 0.4
export const RUBBER = 1 / 3
export const PULL_RATIO = 0.5
export const PULL_MAX = 96
export const PULL_TRIGGER = 64

export type Lock = 'horizontal' | 'vertical'
export type Decision = 'next' | 'prev' | 'cancel'
export interface Sample { x: number; y: number; t: number }

/** Indirection so tests can control time. */
export const swipeClock = { now: (): number => performance.now() }

export function lockFor(dx: number, dy: number): Lock | null {
  if (Math.hypot(dx, dy) < LOCK_PX) return null
  return Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
}

export function dragOffset(dx: number, index: number, count: number): number {
  const pastEnd = (dx > 0 && index === 0) || (dx < 0 && index === count - 1)
  return pastEnd ? dx * RUBBER : dx
}

export function releaseDecision(dx: number, velocity: number, width: number, index: number, count: number): Decision {
  if (dx === 0) return 'cancel'
  const target = index + (dx < 0 ? 1 : -1)
  if (target < 0 || target >= count) return 'cancel'
  const far = Math.abs(dx) > width * COMMIT_RATIO
  const fast = Math.sign(velocity) === Math.sign(dx) && Math.abs(velocity) > COMMIT_VELOCITY
  if (!far && !fast) return 'cancel'
  return dx < 0 ? 'next' : 'prev'
}

export function pullDistance(dy: number): number {
  return Math.min(Math.max(dy, 0) * PULL_RATIO, PULL_MAX)
}

const CONTROLS = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'

export function startsOnControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(CONTROLS) !== null
}

/** Edge zones are left to the browser's back gesture; dialogs own their touches. */
export function ignoreStart(target: EventTarget | null, x: number, width: number): boolean {
  if (x < EDGE_PX || x > width - EDGE_PX) return true
  if (document.querySelector('[aria-modal="true"]')) return true
  return startsOnControl(target)
}

export function velocityOf(prev: Sample, last: Sample, axis: 'x' | 'y', now: number): number {
  if (now - last.t > 100 || last.t === prev.t) return 0
  return (last[axis] - prev[axis]) / (last.t - prev.t)
}

export interface TabSwipeHandlers {
  /** Horizontal lock: raw finger distance on every move. */
  onDrag(dx: number): void
  onRelease(dx: number, velocity: number): void
  /** Set to enable pull to refresh: called on every move of a downward pull that started at scroll top. */
  onPull?(dy: number): void
  onPullEnd?(dy: number): void
}

/**
 * One touch stream for both gestures. After a 10px lock, sideways is a tab swipe and down-at-top is a pull;
 * anything else is left to native scrolling. `touchmove` is non-passive so a locked gesture can block scrolling.
 */
export function useTabSwipe(ref: RefObject<HTMLElement | null>, enabled: boolean, handlers: TabSwipeHandlers): void {
  const handlersRef = useRef(handlers)
  useLayoutEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return
    let start: Sample | null = null
    let prev: Sample = { x: 0, y: 0, t: 0 }
    let last: Sample = prev
    let lock: 'horizontal' | 'pull' | 'ignored' | null = null
    let atTop = false

    function onStart(event: TouchEvent): void {
      const touch = event.touches[0]
      if (event.touches.length !== 1 || ignoreStart(event.target, touch.clientX, window.innerWidth)) {
        start = null
        return
      }
      start = { x: touch.clientX, y: touch.clientY, t: swipeClock.now() }
      prev = start
      last = start
      lock = null
      atTop = window.scrollY <= 0
    }

    function onMove(event: TouchEvent): void {
      if (!start) return
      const touch = event.touches[0]
      prev = last
      last = { x: touch.clientX, y: touch.clientY, t: swipeClock.now() }
      const dx = last.x - start.x
      const dy = last.y - start.y
      const canPull = atTop && handlersRef.current.onPull !== undefined
      if (lock === null) {
        // At the top there is nothing to scroll up to, so block the native bounce before the lock decides.
        if (canPull && dy > 0 && event.cancelable) event.preventDefault()
        const next = lockFor(dx, dy)
        if (next === null) return
        lock = next === 'horizontal' ? 'horizontal' : canPull && dy > 0 ? 'pull' : 'ignored'
      }
      if (lock === 'horizontal') {
        if (event.cancelable) event.preventDefault()
        handlersRef.current.onDrag(dx)
      } else if (lock === 'pull') {
        if (event.cancelable) event.preventDefault()
        handlersRef.current.onPull?.(dy)
      }
    }

    function onEnd(event: TouchEvent): void {
      if (!start) return
      const touch = event.changedTouches[0]
      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      if (lock === 'horizontal') handlersRef.current.onRelease(dx, velocityOf(prev, last, 'x', swipeClock.now()))
      else if (lock === 'pull') handlersRef.current.onPullEnd?.(dy)
      start = null
      lock = null
    }

    function onCancel(): void {
      if (lock === 'horizontal') handlersRef.current.onRelease(0, 0)
      else if (lock === 'pull') handlersRef.current.onPullEnd?.(0)
      start = null
      lock = null
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onCancel)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onCancel)
    }
  }, [ref, enabled])
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/useTabSwipe.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Lint and commit**

```bash
cd web && npm run lint
cd .. && git add web/src/app/useTabSwipe.ts web/src/app/useTabSwipe.test.ts
git commit -m "feat(web): gesture rules and touch hook for tab swipes

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: `SwipeTabs` in the shell

**Files:**
- Create: `web/src/lib/useMediaQuery.ts`
- Create: `web/src/app/tabs.ts`
- Create: `web/src/app/tabPages.tsx`
- Create: `web/src/app/SwipeTabs.tsx`
- Create: `web/src/test/touch.ts` (test helpers)
- Modify: `web/src/app/Shell.tsx` (replace the local `NAV` array and the `<Outlet />` in `<main>`)
- Test: `web/src/app/SwipeTabs.test.tsx`

**Interfaces:**
- Consumes (Task 1, `./useTabSwipe`): `dragOffset`, `releaseDecision`, `useTabSwipe`, `swipeClock`.
- Produces:
  - `useMediaQuery(query: string): boolean`, `MOBILE_QUERY = '(max-width: 767.98px)'`,
    `REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'` from `web/src/lib/useMediaQuery.ts`
  - `interface Tab { to: string; label: string; icon: TabIcon; end: boolean }`, `TABS: readonly Tab[]`,
    `tabIndex(pathname: string): number` from `web/src/app/tabs.ts`
  - `renderTabPage(to: string): ReactElement | null` from `web/src/app/tabPages.tsx`
  - `SwipeTabs` component (no props; renders the routed `<Outlet />`), `SETTLE_MS = 250`, `FADE_MS = 150`, and a
    `trackRef`-based layout that Task 3 extends with `PULL_PATHS` and `<PullToRefresh>`
  - Test helpers in `web/src/test/touch.ts`: `stubMedia({ mobile?, reduced? })`, `useFakeSwipeClock()`,
    `drag(target: Element, from: [number, number], to: [number, number], ms?: number, steps?: number)`, `pause(ms)`

- [ ] **Step 1: Add the media-query hook and the tab list**

`web/src/lib/useMediaQuery.ts`:

```ts
import { useSyncExternalStore } from 'react'

export const MOBILE_QUERY = '(max-width: 767.98px)'
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** False where `matchMedia` doesn't exist (jsdom). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  )
}
```

`web/src/app/tabs.ts`:

```ts
import { AccountIcon, HabitsIcon, ProgressIcon, TodayIcon, type TabIcon } from './TabIcons'

export interface Tab { to: string; label: string; icon: TabIcon; end: boolean }

/** Order of the sidebar, the tab bar, and tab swipes. */
export const TABS: readonly Tab[] = [
  { to: '/', label: 'Today', icon: TodayIcon, end: true },
  { to: '/progress', label: 'Progress', icon: ProgressIcon, end: false },
  { to: '/habits', label: 'Habits', icon: HabitsIcon, end: false },
  { to: '/settings', label: 'Account', icon: AccountIcon, end: false },
]

/** −1 when the path isn't a tab. */
export function tabIndex(pathname: string): number {
  return TABS.findIndex((tab) => tab.to === pathname)
}
```

`web/src/app/tabPages.tsx`:

```tsx
import type { ReactElement } from 'react'
import { AccountPage } from '../features/account/AccountPage'
import { HabitsPage } from '../features/habits/HabitsPage'
import { ProgressPage } from '../features/progress/ProgressPage'
import { TodayPage } from '../features/today/TodayPage'

/** The neighbour drawn beside the current tab while swiping. Separate from tabs.ts to avoid an import cycle. */
export function renderTabPage(to: string): ReactElement | null {
  switch (to) {
    case '/': return <TodayPage />
    case '/progress': return <ProgressPage />
    case '/habits': return <HabitsPage />
    case '/settings': return <AccountPage />
    default: return null
  }
}
```

In `web/src/app/Shell.tsx`:
- delete the `NAV` constant and the `TabIcons` import;
- add `import { TABS } from './tabs'` and `import { SwipeTabs } from './SwipeTabs'`;
- replace both `NAV.map(` with `TABS.map(`;
- replace `<Outlet />` inside `<main>` with `<SwipeTabs />` and drop `Outlet` from the `react-router` import
  (it becomes `import { NavLink } from 'react-router'`).

- [ ] **Step 2: Add the touch test helpers**

`web/src/test/touch.ts`:

```ts
import { fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { swipeClock } from '../app/useTabSwipe'
import { MOBILE_QUERY, REDUCED_MOTION_QUERY } from '../lib/useMediaQuery'

/** Phone-sized window with the given media features. `setup.ts` unstubs globals after each test. */
export function stubMedia({ mobile = true, reduced = false }: { mobile?: boolean; reduced?: boolean } = {}): void {
  vi.stubGlobal('innerWidth', 390)
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === MOBILE_QUERY ? mobile : query === REDUCED_MOTION_QUERY ? reduced : false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
}

let time = 0

/** Drives `swipeClock` from `drag()` so velocities are exact. Restore with `vi.restoreAllMocks()`. */
export function useFakeSwipeClock(): void {
  time = 0
  vi.spyOn(swipeClock, 'now').mockImplementation(() => time)
}

/** A one-finger drag in `steps` moves spread over `ms`. */
export function drag(target: Element, from: [number, number], to: [number, number], ms = 300, steps = 5): void {
  time = 0
  fireEvent.touchStart(target, { touches: [{ clientX: from[0], clientY: from[1] }] })
  for (let i = 1; i <= steps; i++) {
    time = (ms * i) / steps
    fireEvent.touchMove(target, {
      touches: [{ clientX: from[0] + ((to[0] - from[0]) * i) / steps, clientY: from[1] + ((to[1] - from[1]) * i) / steps }],
    })
  }
  fireEvent.touchEnd(target, { changedTouches: [{ clientX: to[0], clientY: to[1] }] })
}

export function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
```

- [ ] **Step 3: Write the failing component tests**

`web/src/app/SwipeTabs.test.tsx`:

```tsx
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { createQueryClient } from '../api/queryClient'
import { drag, pause, stubMedia, useFakeSwipeClock } from '../test/touch'
import { LocationDisplay } from '../test/utils'
import { SETTLE_MS, SwipeTabs } from './SwipeTabs'

vi.mock('./tabPages', () => ({ renderTabPage: (to: string) => <p>Neighbour {to}</p> }))

function renderTabs(route = '/') {
  const queryClient = createQueryClient({ retry: false })
  const refetch = vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue()
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route element={<SwipeTabs />}>
            <Route path="/" element={<p>Today page</p>} />
            <Route path="/progress" element={<p>Progress page <input aria-label="Note" /></p>} />
            <Route path="/habits" element={<p>Habits page</p>} />
            <Route path="/settings" element={<p>Account page</p>} />
            <Route path="*" element={<p>Missing page</p>} />
          </Route>
        </Routes>
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { refetch }
}

const location = () => screen.getByTestId('location-display')

beforeEach(() => {
  stubMedia()
  useFakeSwipeClock()
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('tab swipe', () => {
  test('a left swipe on Today goes to Progress', async () => {
    renderTabs('/')
    drag(screen.getByText('Today page'), [300, 400], [100, 400])
    await waitFor(() => expect(location()).toHaveTextContent('/progress'))
    expect(screen.getByText('Progress page')).toBeInTheDocument()
  })

  test('a fast short flick also switches', async () => {
    renderTabs('/')
    drag(screen.getByText('Today page'), [300, 400], [240, 400], 50)
    await waitFor(() => expect(location()).toHaveTextContent('/progress'))
  })

  test('a right swipe on Progress goes back to Today', async () => {
    renderTabs('/progress')
    drag(screen.getByText('Progress page'), [100, 400], [300, 400])
    await waitFor(() => expect(location()).toHaveTextContent(/^\/$/))
  })

  test('shows the neighbour while dragging', () => {
    renderTabs('/')
    drag(screen.getByText('Today page'), [300, 400], [200, 400])
    expect(screen.getByText('Neighbour /progress')).toBeInTheDocument()
  })

  test.each([
    ['a short slow drag', '/', [300, 400], [250, 400]],
    ['a right swipe on Today', '/', [100, 400], [350, 400]],
    ['a left swipe on Account', '/settings', [300, 400], [40, 400]],
    ['a start in the right edge zone', '/', [380, 400], [100, 400]],
    ['a vertical drag', '/', [200, 300], [215, 500]],
  ] as const)('%s stays put', async (_name, route, from, to) => {
    renderTabs(route)
    drag(screen.getByText(/page/), [...from], [...to])
    await pause(SETTLE_MS + 50)
    expect(location()).toHaveTextContent(new RegExp(`^${route}$`))
  })

  test('a swipe starting on a form control is ignored', async () => {
    renderTabs('/progress')
    drag(screen.getByLabelText('Note'), [100, 400], [300, 400])
    await pause(SETTLE_MS + 50)
    expect(location()).toHaveTextContent('/progress')
  })

  test('no swipe while a dialog is open', async () => {
    renderTabs('/')
    const dialog = document.createElement('div')
    dialog.setAttribute('aria-modal', 'true')
    document.body.appendChild(dialog)
    drag(screen.getByText('Today page'), [300, 400], [100, 400])
    await pause(SETTLE_MS + 50)
    expect(location()).toHaveTextContent(/^\/$/)
  })

  test('no swipe on desktop', async () => {
    stubMedia({ mobile: false })
    renderTabs('/')
    drag(screen.getByText('Today page'), [300, 400], [100, 400])
    await pause(SETTLE_MS + 50)
    expect(location()).toHaveTextContent(/^\/$/)
  })

  test('non-tab routes render without swipe', async () => {
    renderTabs('/nope')
    drag(screen.getByText('Missing page'), [300, 400], [100, 400])
    await pause(SETTLE_MS + 50)
    expect(location()).toHaveTextContent('/nope')
  })

  test('with reduced motion, a committed swipe still switches tabs', async () => {
    stubMedia({ reduced: true })
    renderTabs('/')
    drag(screen.getByText('Today page'), [300, 400], [100, 400])
    expect(screen.queryByText('Neighbour /progress')).not.toBeInTheDocument()
    await waitFor(() => expect(location()).toHaveTextContent('/progress'))
  })
})
```

Note on the "shows the neighbour" test: that 100px slow drag is a cancel, and `drag()` releases the finger. The
neighbour stays mounted for the 250 ms snap-back, so it is still in the DOM right after `drag()` returns.

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/app/SwipeTabs.test.tsx`
Expected: FAIL, cannot resolve `./SwipeTabs`.

- [ ] **Step 5: Implement `SwipeTabs`**

`web/src/app/SwipeTabs.tsx`:

```tsx
import { useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { MOBILE_QUERY, REDUCED_MOTION_QUERY, useMediaQuery } from '../lib/useMediaQuery'
import { renderTabPage } from './tabPages'
import { TABS, tabIndex } from './tabs'
import { dragOffset, releaseDecision, useTabSwipe } from './useTabSwipe'

export const SETTLE_MS = 250
export const FADE_MS = 150

interface Neighbour { from: string; dir: 1 | -1; top: number }

/** Mobile tab swipe: the routed page follows the finger and the next tab peeks in beside it. */
export function SwipeTabs() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const mobile = useMediaQuery(MOBILE_QUERY)
  const reduced = useMediaQuery(REDUCED_MOTION_QUERY)
  const index = tabIndex(pathname)
  const enabled = mobile && index >= 0
  const trackRef = useRef<HTMLDivElement>(null)
  const [neighbour, setNeighbour] = useState<Neighbour | null>(null)
  const settling = useRef(false)
  const snapTimer = useRef<number | undefined>(undefined)
  const scrollOnArrive = useRef(false)

  // A committed swipe lands here: reset the track before the new page paints.
  useLayoutEffect(() => {
    const track = trackRef.current
    if (track) {
      track.style.transition = ''
      track.style.transform = ''
      track.style.opacity = ''
    }
    settling.current = false
    if (scrollOnArrive.current) {
      scrollOnArrive.current = false
      window.scrollTo(0, 0)
    }
  }, [pathname])

  function moveTrack(x: number, ms = 0): void {
    const track = trackRef.current
    if (!track) return
    track.style.transition = ms ? `transform ${ms}ms ease-out` : ''
    track.style.transform = x ? `translateX(${x}px)` : ''
  }

  useTabSwipe(trackRef, enabled, {
    onDrag(dx) {
      if (settling.current || reduced) return
      window.clearTimeout(snapTimer.current)
      const dir = dx < 0 ? 1 : -1
      const target = index + dir
      const shown = neighbour !== null && neighbour.from === pathname && neighbour.dir === dir
      if (!shown && target >= 0 && target < TABS.length && trackRef.current) {
        const trackTop = trackRef.current.getBoundingClientRect().top + window.scrollY
        setNeighbour({ from: pathname, dir, top: Math.max(0, window.scrollY - trackTop) })
      }
      moveTrack(dragOffset(dx, index, TABS.length))
    },
    onRelease(dx, velocity) {
      if (settling.current) return
      const decision = releaseDecision(dx, velocity, window.innerWidth, index, TABS.length)
      if (decision === 'cancel') {
        moveTrack(0, reduced ? 0 : SETTLE_MS)
        snapTimer.current = window.setTimeout(() => setNeighbour(null), SETTLE_MS)
        return
      }
      settling.current = true
      const to = TABS[index + (decision === 'next' ? 1 : -1)].to
      const track = trackRef.current
      if (reduced && track) {
        track.style.transition = `opacity ${FADE_MS}ms ease-out`
        track.style.opacity = '0'
      } else {
        moveTrack(decision === 'next' ? -window.innerWidth : window.innerWidth, SETTLE_MS)
      }
      window.setTimeout(() => {
        scrollOnArrive.current = true
        navigate(to)
      }, reduced ? FADE_MS : SETTLE_MS)
    },
  })

  if (!enabled) return <Outlet />

  const peer = neighbour && neighbour.from === pathname ? neighbour : null
  return (
    <div className="overflow-x-clip">
      <div ref={trackRef} className="relative">
        <Outlet />
        {peer && (
          <div aria-hidden="true" inert className="absolute w-full"
            style={{ top: peer.top, left: peer.dir * window.innerWidth }}>
            {renderTabPage(TABS[index + peer.dir].to)}
          </div>
        )}
      </div>
    </div>
  )
}

export default SwipeTabs
```

Why `left: dir × innerWidth`: the track sits inside `<main>`'s 20px side padding. Placing the neighbour one full
screen width away and settling the track by one screen width lands the neighbour exactly where the current page was.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/app/SwipeTabs.test.tsx`
Expected: PASS.

- [ ] **Step 7: Full validation and commit**

Run: `npx vitest run && npm run lint && npm run build`
Expected: all tests pass (147 existing + new), lint shows only the 2 expected warnings, build succeeds.

```bash
cd .. && git add web/src/lib/useMediaQuery.ts web/src/app/tabs.ts web/src/app/tabPages.tsx web/src/app/SwipeTabs.tsx \
  web/src/app/SwipeTabs.test.tsx web/src/test/touch.ts web/src/app/Shell.tsx
git commit -m "feat(web): swipe between tabs on phones

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Pull to refresh on Today and Progress

**Files:**
- Create: `web/src/app/PullToRefresh.tsx`
- Modify: `web/src/app/SwipeTabs.tsx` (wire `onPull`/`onPullEnd`, render the chip)
- Modify: `web/src/index.css` (turn off Chrome's pull-to-reload)
- Test: `web/src/app/SwipeTabs.test.tsx` (add a `describe('pull to refresh')` block)

**Interfaces:**
- Consumes: `pullDistance`, `PULL_TRIGGER` (Task 1); `SwipeTabs`, `trackRef`, `enabled`, `renderTabs` harness
  (Task 2).
- Produces: `PullToRefresh({ ref }: { ref: Ref<PullToRefreshHandle> })`,
  `interface PullToRefreshHandle { move(dy: number): void; release(dy: number): void }`,
  `MIN_SPIN_MS = 400`, `OFFLINE_MS = 1200`, `RETURN_MS = 200`; `PULL_PATHS` in `SwipeTabs.tsx`.

- [ ] **Step 1: Write the failing tests**

Append to `web/src/app/SwipeTabs.test.tsx` (add `import { onlineManager } from '@tanstack/react-query'` to the imports):

```tsx
describe('pull to refresh', () => {
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  test('pulling past the threshold on Today refetches the page', async () => {
    const { refetch } = renderTabs('/')
    drag(screen.getByText('Today page'), [200, 100], [200, 300])
    expect(refetch).toHaveBeenCalledWith({ type: 'active' })
    expect(await screen.findByText('Refreshing')).toBeInTheDocument()
  })

  test('works on Progress too', () => {
    const { refetch } = renderTabs('/progress')
    drag(screen.getByText('Progress page'), [200, 100], [200, 300])
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  test('a short pull does nothing', () => {
    const { refetch } = renderTabs('/')
    drag(screen.getByText('Today page'), [200, 100], [200, 180])
    expect(refetch).not.toHaveBeenCalled()
  })

  test('offline shows “Offline” and sends nothing', async () => {
    onlineManager.setOnline(false)
    const { refetch } = renderTabs('/')
    drag(screen.getByText('Today page'), [200, 100], [200, 300])
    expect(await screen.findByText('Offline')).toBeInTheDocument()
    expect(refetch).not.toHaveBeenCalled()
  })

  test('not on Habits', () => {
    const { refetch } = renderTabs('/habits')
    drag(screen.getByText('Habits page'), [200, 100], [200, 300])
    expect(refetch).not.toHaveBeenCalled()
  })

  test('not when the page is scrolled down', () => {
    vi.stubGlobal('scrollY', 120)
    const { refetch } = renderTabs('/')
    drag(screen.getByText('Today page'), [200, 100], [200, 300])
    expect(refetch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/SwipeTabs.test.tsx`
Expected: the new `pull to refresh` tests FAIL (`refetch` not called / text not found); tab-swipe tests still pass.

- [ ] **Step 3: Implement the chip**

`web/src/app/PullToRefresh.tsx`:

```tsx
import { onlineManager, useQueryClient } from '@tanstack/react-query'
import { useImperativeHandle, useRef, useState, type Ref } from 'react'
import { PULL_TRIGGER, pullDistance } from './useTabSwipe'

export const MIN_SPIN_MS = 400
export const OFFLINE_MS = 1200
export const RETURN_MS = 200

export interface PullToRefreshHandle {
  move(dy: number): void
  release(dy: number): void
}

type Phase = 'idle' | 'pulling' | 'refreshing' | 'offline'

const CHIP = 36
const ARC = 2 * Math.PI * 7

/** The pull chip at the top of the screen. Driven by SwipeTabs through the handle. */
export function PullToRefresh({ ref }: { ref: Ref<PullToRefreshHandle> }) {
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<Phase>('idle')
  const [pull, setPull] = useState(0)
  const busy = useRef(false)

  useImperativeHandle(ref, () => {
    function reset(): void {
      busy.current = false
      setPhase('idle')
      setPull(0)
    }
    return {
      move(dy) {
        if (busy.current) return
        setPhase('pulling')
        setPull(pullDistance(dy))
      },
      release(dy) {
        if (busy.current) return
        if (pullDistance(dy) < PULL_TRIGGER) {
          reset()
          return
        }
        busy.current = true
        setPull(PULL_TRIGGER)
        if (!onlineManager.isOnline()) {
          setPhase('offline')
          setTimeout(reset, OFFLINE_MS)
          return
        }
        setPhase('refreshing')
        const minimum = new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS))
        void Promise.allSettled([queryClient.refetchQueries({ type: 'active' }), minimum]).then(reset)
      },
    }
  }, [queryClient])

  const progress = Math.min(pull / PULL_TRIGGER, 1)
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-20 flex justify-center md:hidden"
      style={{
        transform: `translateY(${pull - CHIP - 8}px)`,
        transition: phase === 'pulling' ? 'none' : `transform ${RETURN_MS}ms ease-out`,
      }}>
      <div role="status"
        className="flex h-9 min-w-9 items-center justify-center rounded-full border border-line bg-surface px-2 text-[13px] text-muted shadow-[0_8px_24px_rgb(0_0_0/0.45)]">
        {phase === 'offline' ? 'Offline' : (
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"
            className={phase === 'refreshing' ? 'animate-spin motion-reduce:animate-none' : ''}>
            <circle cx="9" cy="9" r="7" fill="none" stroke="var(--color-accent)" strokeWidth="2.2" strokeLinecap="round"
              strokeDasharray={`${ARC * (phase === 'refreshing' ? 0.75 : progress)} ${ARC}`} transform="rotate(-90 9 9)" />
          </svg>
        )}
        {phase === 'refreshing' && <span className="sr-only">Refreshing</span>}
      </div>
    </div>
  )
}

export default PullToRefresh
```

- [ ] **Step 4: Wire it into `SwipeTabs`**

In `web/src/app/SwipeTabs.tsx`:

1. Add imports: `import { PullToRefresh, type PullToRefreshHandle } from './PullToRefresh'`.
2. Below `FADE_MS` add: `const PULL_PATHS = new Set(['/', '/progress'])`.
3. Inside the component, after `trackRef`: 

```tsx
  const pullRef = useRef<PullToRefreshHandle>(null)
  const pulls = enabled && PULL_PATHS.has(pathname)
```

4. Add these two entries to the handlers object passed to `useTabSwipe` (after `onRelease`):

```tsx
    onPull: pulls ? (dy) => pullRef.current?.move(dy) : undefined,
    onPullEnd: pulls ? (dy) => pullRef.current?.release(dy) : undefined,
```

5. Replace the mobile `return (...)` with a fragment. The chip must sit outside the track, because a `transform` on
   the track would make a `fixed` child move with it:

```tsx
  return (
    <>
      <div className="overflow-x-clip">
        <div ref={trackRef} className="relative">
          <Outlet />
          {peer && (
            <div aria-hidden="true" inert className="absolute w-full"
              style={{ top: peer.top, left: peer.dir * window.innerWidth }}>
              {renderTabPage(TABS[index + peer.dir].to)}
            </div>
          )}
        </div>
      </div>
      {pulls && <PullToRefresh ref={pullRef} />}
    </>
  )
```

In `web/src/index.css`, add at the end:

```css
/* Our own pull to refresh replaces Chrome's pull-to-reload. */
html {
  overscroll-behavior-y: contain;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/app/SwipeTabs.test.tsx`
Expected: PASS (tab swipe and pull to refresh).

- [ ] **Step 6: Full validation and commit**

Run: `npx vitest run && npm run lint && npm run build`
Expected: all pass, only the 2 expected lint warnings.

```bash
cd .. && git add web/src/app/PullToRefresh.tsx web/src/app/SwipeTabs.tsx web/src/app/SwipeTabs.test.tsx web/src/index.css
git commit -m "feat(web): pull to refresh on Today and Progress

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Swipe the check-in sheet down to close it

**Files:**
- Create: `web/src/features/checkin/useSheetDrag.ts`
- Modify: `web/src/features/checkin/CellPicker.tsx` (ref on the `role="dialog"` element, call the hook)
- Test: `web/src/features/checkin/useSheetDrag.test.tsx`

**Interfaces:**
- Consumes (Task 1): `COMMIT_VELOCITY`, `lockFor`, `startsOnControl`, `swipeClock`, `velocityOf`, `type Sample`;
  (Task 2): `useMediaQuery`, `MOBILE_QUERY`, `REDUCED_MOTION_QUERY`; test helpers `drag`, `stubMedia`,
  `useFakeSwipeClock`, `pause`.
- Produces: `SHEET_CLOSE_RATIO = 0.3`, `SHEET_SETTLE_MS = 200`,
  `shouldCloseSheet(dy: number, velocity: number, height: number): boolean`,
  `useSheetDrag(ref: RefObject<HTMLElement | null>, options: { enabled: boolean; reduced: boolean; onClose(): void }): void`.

- [ ] **Step 1: Write the failing tests**

`web/src/features/checkin/useSheetDrag.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { drag, pause, stubMedia, useFakeSwipeClock } from '../../test/touch'
import { SHEET_SETTLE_MS, shouldCloseSheet, useSheetDrag } from './useSheetDrag'

describe('shouldCloseSheet', () => {
  test('closes past 30% of the sheet height', () => {
    expect(shouldCloseSheet(130, 0, 400)).toBe(true)
    expect(shouldCloseSheet(110, 0, 400)).toBe(false)
  })
  test('closes on a fast downward flick', () => {
    expect(shouldCloseSheet(30, 0.5, 400)).toBe(true)
    expect(shouldCloseSheet(30, -0.5, 400)).toBe(false)
  })
})

function Sheet({ onClose, enabled = true, reduced = false }: { onClose(): void; enabled?: boolean; reduced?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useSheetDrag(ref, { enabled, reduced, onClose })
  return (
    <div ref={ref} role="dialog" aria-modal="true">
      <p>Sheet body</p>
      <textarea aria-label="Note" />
    </div>
  )
}

describe('useSheetDrag', () => {
  beforeEach(() => {
    stubMedia()
    useFakeSwipeClock()
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('a long downward drag closes the sheet after it slides away', async () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    drag(screen.getByText('Sheet body'), [200, 500], [200, 700])
    expect(onClose).not.toHaveBeenCalled()
    await pause(SHEET_SETTLE_MS + 50)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('with reduced motion it closes at once', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} reduced />)
    drag(screen.getByText('Sheet body'), [200, 500], [200, 700])
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test.each([
    ['a short slow drag', [200, 500], [200, 560]],
    ['an upward drag', [200, 500], [200, 300]],
    ['a sideways drag', [100, 500], [300, 520]],
  ] as const)('%s keeps it open', async (_name, from, to) => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    drag(screen.getByText('Sheet body'), [...from], [...to])
    await pause(SHEET_SETTLE_MS + 50)
    expect(onClose).not.toHaveBeenCalled()
  })

  test('a drag starting in the note field keeps it open', async () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    drag(screen.getByLabelText('Note'), [200, 500], [200, 700])
    await pause(SHEET_SETTLE_MS + 50)
    expect(onClose).not.toHaveBeenCalled()
  })

  test('disabled on desktop', async () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} enabled={false} />)
    drag(screen.getByText('Sheet body'), [200, 500], [200, 700])
    await pause(SHEET_SETTLE_MS + 50)
    expect(onClose).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/checkin/useSheetDrag.test.tsx`
Expected: FAIL, cannot resolve `./useSheetDrag`.

- [ ] **Step 3: Implement the hook**

`web/src/features/checkin/useSheetDrag.ts`:

```ts
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { COMMIT_VELOCITY, lockFor, startsOnControl, swipeClock, velocityOf, type Sample } from '../../app/useTabSwipe'

export const SHEET_CLOSE_RATIO = 0.3
export const SHEET_SETTLE_MS = 200

export function shouldCloseSheet(dy: number, velocity: number, height: number): boolean {
  return dy > height * SHEET_CLOSE_RATIO || velocity > COMMIT_VELOCITY
}

interface Options { enabled: boolean; reduced: boolean; onClose(): void }

/** Drag a bottom sheet down to close it. Upward drags don't move it. */
export function useSheetDrag(ref: RefObject<HTMLElement | null>, { enabled, reduced, onClose }: Options): void {
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return
    const sheet = el
    let start: Sample | null = null
    let prev: Sample = { x: 0, y: 0, t: 0 }
    let last: Sample = prev
    let lock: 'down' | 'ignored' | null = null
    let timer: number | undefined

    function place(y: number, ms = 0): void {
      sheet.style.transition = ms ? `transform ${ms}ms ease-out` : ''
      sheet.style.transform = y ? `translateY(${y}px)` : ''
    }

    function onStart(event: TouchEvent): void {
      if (event.touches.length !== 1 || startsOnControl(event.target)) {
        start = null
        return
      }
      const touch = event.touches[0]
      start = { x: touch.clientX, y: touch.clientY, t: swipeClock.now() }
      prev = start
      last = start
      lock = null
    }

    function onMove(event: TouchEvent): void {
      if (!start) return
      const touch = event.touches[0]
      prev = last
      last = { x: touch.clientX, y: touch.clientY, t: swipeClock.now() }
      const dx = last.x - start.x
      const dy = last.y - start.y
      if (lock === null) {
        const next = lockFor(dx, dy)
        if (next === null) return
        lock = next === 'vertical' && dy > 0 ? 'down' : 'ignored'
      }
      if (lock !== 'down') return
      if (event.cancelable) event.preventDefault()
      if (!reduced) place(Math.max(dy, 0))
    }

    function onEnd(event: TouchEvent): void {
      if (!start || lock !== 'down') {
        start = null
        return
      }
      const dy = Math.max(event.changedTouches[0].clientY - start.y, 0)
      const velocity = velocityOf(prev, last, 'y', swipeClock.now())
      start = null
      if (!shouldCloseSheet(dy, velocity, sheet.offsetHeight)) {
        place(0, reduced ? 0 : SHEET_SETTLE_MS)
        return
      }
      if (reduced) {
        onCloseRef.current()
        return
      }
      place(sheet.offsetHeight, SHEET_SETTLE_MS)
      timer = window.setTimeout(() => onCloseRef.current(), SHEET_SETTLE_MS)
    }

    function onCancel(): void {
      if (lock === 'down') place(0)
      start = null
    }

    sheet.addEventListener('touchstart', onStart, { passive: true })
    sheet.addEventListener('touchmove', onMove, { passive: false })
    sheet.addEventListener('touchend', onEnd)
    sheet.addEventListener('touchcancel', onCancel)
    return () => {
      window.clearTimeout(timer)
      sheet.removeEventListener('touchstart', onStart)
      sheet.removeEventListener('touchmove', onMove)
      sheet.removeEventListener('touchend', onEnd)
      sheet.removeEventListener('touchcancel', onCancel)
    }
  }, [ref, enabled, reduced])
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/checkin/useSheetDrag.test.tsx`
Expected: PASS.

- [ ] **Step 5: Use it in `CellPicker`**

In `web/src/features/checkin/CellPicker.tsx`:

1. Change the React import to `import { useRef, useState } from 'react'` and add:

```ts
import { MOBILE_QUERY, REDUCED_MOTION_QUERY, useMediaQuery } from '../../lib/useMediaQuery'
import { useSheetDrag } from './useSheetDrag'
```

2. At the top of the `CellPicker` body, after the existing hooks:

```ts
  const sheetRef = useRef<HTMLDivElement>(null)
  const mobile = useMediaQuery(MOBILE_QUERY)
  const reduced = useMediaQuery(REDUCED_MOTION_QUERY)
  useSheetDrag(sheetRef, { enabled: mobile, reduced, onClose })
```

3. Add `ref={sheetRef}` to the `<div role="dialog" aria-modal="true" …>` element.

- [ ] **Step 6: Full validation and commit**

Run: `npx vitest run && npm run lint && npm run build`
Expected: all pass, only the 2 expected lint warnings.

```bash
cd .. && git add web/src/features/checkin/useSheetDrag.ts web/src/features/checkin/useSheetDrag.test.tsx \
  web/src/features/checkin/CellPicker.tsx
git commit -m "feat(web): swipe the check-in sheet down to close it

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Playwright drag test

**Files:**
- Modify: `web/playwright.config.ts` (base URL from `E2E_BASE_URL`)
- Create: `web/e2e/swipe.spec.ts`

**Interfaces:**
- Consumes: the running app (Tasks 2–3). Tab links are `NavLink`s inside `nav[aria-label=Tabs]` with `sr-only` labels
  (`Today`, `Progress`, `Habits`, `Account`); the active one has `aria-current="page"`.

Local environment note: port 5173 may be another project's dev server. Run against the Chronos dev server with
`E2E_BASE_URL` (for example `http://localhost:5174`, a Vite dev server whose `/api` proxy reaches the Chronos API).

- [ ] **Step 1: Let the config take a base URL**

In `web/playwright.config.ts`, add above `export default`:

```ts
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
```

and use `BASE_URL` for both `use.baseURL` and `webServer.url`. Update the header comment's last sentence to:
"Reuses a dev server that's already running; set `E2E_BASE_URL` to point at a different one."

- [ ] **Step 2: Write the test**

`web/e2e/swipe.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test'

/** Real touch events through CDP; Playwright's touchscreen only taps. */
async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 12) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }],
    })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

test('swiping left on Today opens Progress, and right comes back', async ({ page }) => {
  await page.goto('/signup')
  await page.getByLabel('Username').fill(`e2e_swipe_${Date.now()}`)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByRole('link', { name: 'Create your first habit' })).toBeVisible()

  const tabs = page.getByRole('navigation', { name: 'Tabs' })
  await touchDrag(page, { x: 320, y: 420 }, { x: 60, y: 420 })
  await expect(page).toHaveURL(/\/progress$/)
  await expect(tabs.getByRole('link', { name: 'Progress' })).toHaveAttribute('aria-current', 'page')

  await touchDrag(page, { x: 60, y: 420 }, { x: 320, y: 420 })
  await expect(page).toHaveURL(/\/$/)
  await expect(tabs.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
})
```

- [ ] **Step 3: Run it**

Run (from `web/`, with the Chronos API and its Vite dev server running): `E2E_BASE_URL=http://localhost:5174 npx playwright test e2e/swipe.spec.ts`
Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
cd .. && git add web/playwright.config.ts web/e2e/swipe.spec.ts
git commit -m "test(web): e2e drag between tabs

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
