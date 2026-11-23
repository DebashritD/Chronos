# Offline support — design

Status: approved 2026-11-23

## Goal

Chronos opens and shows the last-seen data with no connection, and habits can be marked
offline. Marks sync automatically when the connection returns.

## Decisions

| Question | Decision |
|---|---|
| Scope | Read + mark. Check-in save/clear works offline. Creating, editing, pausing and archiving habits needs a connection. |
| Feedback | Quiet. Marks show instantly, with a small dim status line. Streaks and the yellow-limit dialog update after sync. |
| Conflicts | Replay wins. A queued mark is sent as-is and overwrites the server value. No API change. |
| New day offline | Today's periods are derived on the device from the saved habits, mirroring the server's `HabitSchedule`. |
| Approach | `vite-plugin-pwa` (Workbox) for the app shell, the TanStack Query persister (IndexedDB) for data, and TanStack paused mutations as the queue. |

## 1. App shell and saved data

- **App shell.** `vite-plugin-pwa` with `registerType: 'autoUpdate'` precaches the built JS/CSS, fonts, icons and
  `index.html`.
  - `navigateFallback: 'index.html'` serves every route offline; `navigateFallbackDenylist: [/^\/api\//]`.
  - The service worker caches no `/api` responses; TanStack Query owns all data.
  - The plugin reuses the existing `public/manifest.webmanifest` (`manifest: false`).
  - A new version activates silently and applies on the next launch.
- **Persisted query cache.**
  - Uses `PersistQueryClientProvider` from `@tanstack/react-query-persist-client` with an async persister over
    `idb-keyval`, key `chronos-cache`.
  - `maxAge` is 7 days. `buster` is `CACHE_VERSION` (a constant, starting at `'1'`), bumped by hand only when the
    shape of cached data changes, so ordinary deploys keep saved data and queued marks. Paused mutations are
    dehydrated with the cache (TanStack's default `shouldDehydrateMutation` keeps only paused ones).
  - Query `gcTime` is raised to 7 days so persisted data isn't garbage-collected.
  - Persisted: habits, streaks, every viewed week and month.
  - Queries keep `networkMode: 'online'`: offline they show saved data and pause instead of erroring.
- **Session.**
  - The last `me` is saved to `localStorage` (`chronos.me`). On startup, if `/api/auth/me` fails with a network
    error (no `ApiError`), the saved `me` is used. A 401 still logs out.
  - A 401 no longer wipes pending check-in mutations: the 401 handler and `login()` clear queries only.
  - Pending mutations are kept when the same user id logs back in; on a different user they are discarded.
- **Logout.**
  - Clears the query cache, the mutation cache, `chronos.me` and the IndexedDB entry.
  - If check-ins are still pending it first asks: "{n} marks haven't synced. Log out anyway?"
    (singular: "1 mark hasn't synced. Log out anyway?").
  - Offline, the Log out button (and the confirm in that question) is disabled, with a dim `text-[13px]` line
    "Connect to log out." under it.

## 2. Marking offline

- **Queue.**
  - Save and clear check-in mutations get `mutationKey: ['checkIn']`. `queryClient.setMutationDefaults(['checkIn'],
    …)` supplies `mutationFn` and the cache-invalidating `onSuccess`, so mutations restored after a reload can resume.
  - Variables: `{ op: 'save' | 'clear', habitId, periodStart, color?, note? }`.
  - After the persisted cache is restored, `onSuccess` of the provider calls `queryClient.resumePausedMutations()`.
    TanStack resumes paused mutations in order when `onlineManager` reports online again.
  - After the queue drains, `['stats']` is invalidated once.
- **Optimistic update.**
  - `onMutate` patches every cached `['stats','week',*]` entry: the matching habit's cell (by `periodStart`) and
    `current` get the new `state` (`GREEN`/`YELLOW`/`RED`, or `PENDING` on clear) and `note`.
  - Today's card, summary and segments update at once. Month data refreshes after sync.
- **Replay results.**
  - Network error: stays queued and retries without limit (`retry` with backoff while online; paused while offline).
  - 5xx: retries up to 8 times with the default backoff, then is dropped like a 4xx (a stuck mark would block the
    queue, and TanStack waits for paused mutations before refetching queries on reconnect).
  - 401: the mark reports the 401 to the session (signs out, so the login screen shows) and waits; after the same
    user logs in, the queue resumes.
  - Any other 4xx (e.g. 404 archived habit, 409/422 not editable): drop that mutation, show a toast
    "Couldn’t sync {habit name}. Refreshed.", and invalidate `['stats']`.
- **Yellow-limit dialog.** Runs from the hook-level `onSuccess` as today. It fires when a queued mark syncs while
  the page is still mounted. Marks restored after a reload sync without the dialog.
- **New day offline.**
  - `localTodayWeek(week, habits, timezone, now)`: if `week.today` equals today's date in the user's timezone,
    return `week` unchanged.
  - Otherwise, for each active habit in the saved habits list, compute `periodContaining(today)` with the same rules
    as `HabitSchedule`: weekly periods start on the Monday on or before `startDate`; every-N periods step by
    `intervalDays` from `startDate`; daily step by 1; before the first period → no current period.
    - If the start equals the saved `current.periodStart`, keep the saved `current`.
    - Otherwise make a fresh `current`: `state: 'PENDING'`, `editable: true`, `note: null`,
      `closesAt` = midnight after `periodEnd` in the user's timezone.
  - Paused habits are kept unchanged (Today’s cards already hide them); archived habits are left out; not-yet-started habits get no current period. Streaks stay as last synced.
  - `TodayPage` uses this derived week. The derived cells are patched by the optimistic update like any other.
- **Progress offline.** Shows any saved week or month. A week or month that was never loaded shows
  "Connect to load this week." / "Connect to load this month." instead of an error.

## 3. Status, errors, testing

- **`SyncStatus`.** A dim `text-[13px]` line under the page date on Today and Progress, hidden when online and
  nothing is pending.
  - Offline: "Offline" or "Offline · {n} waiting to sync" (1: "1 waiting to sync").
  - Online with pending: "Syncing {n}…".
  - Driven by `onlineManager` and `useMutationState({ filters: { mutationKey: ['checkIn'], status: 'pending' } })`.
- **`WakingNotice`.** Hidden while offline.
- **Toasts.** Sync failures use a quiet one-line toast that auto-dismisses after 4 s. Never red text.
- **Copy rules.** Curly apostrophes (’), no exclamation marks.
  - New copy: "Offline", "Offline · {n} waiting to sync", "Syncing {n}…", "Couldn’t sync {habit name}. Refreshed.",
    "{n} marks haven’t synced. Log out anyway?", "Connect to load this week.", "Connect to load this month.",
    "Connect to log out."
- **Unit tests (vitest).**
  - `localTodayWeek`: daily, every-N, weekly; new week; before start; paused excluded; unchanged period kept;
    `closesAt` in a non-UTC timezone.
  - The optimistic week patch (save and clear).
  - `SyncStatus` copy for each case.
  - The queue with `onlineManager.setOnline(false)`: a mark pauses, shows instantly, and replays when back
    online; a 4xx, or a 5xx after 8 retries, drops it with a toast.
  - Logout with pending marks asks first; logout is disabled offline; a check-in 401 signs out and keeps the queue.
- **E2E (Playwright).** A second config runs against `vite preview` of a production build (the service worker only
  exists there). Sign up, add a habit, go offline (`context.setOffline(true)`), mark it, reload, see the mark and
  "Offline · 1 waiting to sync", go online, wait for the status to clear, and confirm with a fresh fetch that the
  server has the mark.

## Out of scope

- Creating, editing, pausing or archiving habits offline.
- Device-side streak computation.
- Last-write-wins by tap time (would need an API change).
- Background Sync (marks sync only while the app is open).
