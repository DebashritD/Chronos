# Onboarding journey — design

## Goal

New sign-ups get a short, interactive intro that teaches the three marks, the streak rule, and how to mark a day. Everyone finishes it with at least one real habit. The reference mockup is `.superpowers/mockups/onboarding.html` (git-ignored).

## Who sees it

- Accounts that exist when this ships never see it. The migration marks them onboarded.
- New accounts see it right after sign-up. Until they finish it, every app route sends them to `/welcome`.
- Anyone can replay it from Me. A replay never changes the onboarded state.

## Server

- **Migration `V4__onboarded.sql`:** adds `onboarded_at TIMESTAMPTZ NULL` to `app_user` and sets it to `now()` for every row that already exists.
- **`User`:** gains `onboardedAt` (`OffsetDateTime`, nullable). `UserRepository` reads it and adds `markOnboarded(id)`, which runs `UPDATE app_user SET onboarded_at = now() WHERE id = :id AND onboarded_at IS NULL`.
- **`MeResponse`:** gains `boolean onboarded`, true when `onboardedAt` is set.
- **`POST /api/auth/me/onboarded`:** requires authentication. Calls `markOnboarded` and returns `204`. Repeated calls do nothing more.

## Web

### Routing

- `Me` gains `onboarded: boolean`.
- A new `/welcome` route sits inside `RequireAuth` but outside `Shell`, so it has no tab bar and no swipe.
- `RequireAuth` around `Shell` redirects to `/welcome` when `me.onboarded` is false.
- `SignupPage` keeps `navigate('/')`; the redirect takes it from there.
- `/welcome` renders `OnboardingFlow`. A user who is already onboarded and opens `/welcome` without `?replay` is redirected to `/`.

### OnboardingFlow

`web/src/features/onboarding/OnboardingFlow.tsx` holds the step index, the dots, Skip, and the footer button. Each screen is its own component in the same folder.

| # | Screen | Content | Saves |
|---|---|---|---|
| 1 | Welcome | "Welcome, {username}", the heading "Aim for no reds, not perfect days.", a legend of the three marks, and a "Show me how" button | nothing |
| 2 | How a habit works | A read-only Read example (Minimum 5 pages, Target 20 pages) with explanations, then a "Why this works" box | nothing |
| 3 | Practice tap | A practice HabitCard and CellPicker that use the real components, backed by local state. Hints move through 3 steps. Next is disabled until the first mark. Footer: "practice only · nothing is saved" | nothing |
| 4 | Progress playground | A sample week grid (run lines and dimming) and a Streaks row (NOW · BEST). Tapping a cell cycles Target → Minimum → Missed. A "Minimums allowed in a row" stepper (1–7), starting from `me.maxYellows` | `maxYellows` through `PUT /api/auth/me` on Next, only if it changed |
| 5 | First habit | Starter chips: Read 5/20 pages, Walk 10/30 min, Workout 10/45 min, Meditate 2/10 min, Stretch 1 stretch/15 min. Then "Or create your own" and Name, Minimum, Target fields; frequency is Every day. Create stays disabled until all three are filled, and editing a field clears the selected chip. No Skip | the habit through the existing create-habit API, then `POST /me/onboarded` |
| 6 | Install tip | "{habit} is on your Today", iPhone and Android tabs with 3 steps each, a note that the first open can be slow while the server wakes, and "Go to Today" | nothing; navigates to `/` |

- Skip on screens 1–4 jumps to screen 5.
- Screens 3 and 4 reuse the real `HabitCard`/`CellPicker`/`WeekTiles`/`StreakList` look. Where the real component is tied to API data, a thin local-state wrapper or a presentational extraction is used. The data layer is never faked.
- After a successful create, the session's `me` is refreshed (or patched) so that `onboarded` becomes true.

### Replay, and users who already have a habit

- On Me, a "Replay intro" link goes to `/welcome?replay`.
- In replay mode, `POST /me/onboarded` is never called.
- In any mode, if the user already has a habit, screen 5 shows a "Done" button instead of the form, and screen 6 uses generic copy ("You're all set").
  - Outside replay mode, Done calls `POST /me/onboarded` before moving on.
  - In replay mode, Done just moves on.
- The streak-rule save on screen 4 still applies, because it is the real setting.

## Errors

- **Create habit fails** (offline, server waking, validation): show an inline error under the form and keep the typed values; the user retries with Create.
- **`POST /me/onboarded` fails:** continue to screen 6 anyway. Because `onboarded` is still false, the next app load routes back to `/welcome`. The flow then sees that the user has habits and offers "Done", which retries the call.
- **Done fails:** show an inline error and stay on screen 5.
- **Streak-rule save fails:** show an inline error and stay on screen 4.

## Tests

- **API:**
  - the migration backfills existing users;
  - `/me` returns `onboarded`;
  - `POST /me/onboarded` sets the timestamp and repeated calls do nothing more;
  - the endpoint requires authentication.
- **Web:**
  - a user who isn't onboarded is redirected to `/welcome`, and an onboarded user is redirected away from `/welcome`;
  - Skip jumps to screen 5;
  - Next on screen 3 is disabled until a mark;
  - Create is disabled until all fields are filled, and a starter fills them;
  - creating calls the habit API and then the onboarded endpoint;
  - a create error keeps the values;
  - replay never calls the onboarded endpoint and shows Done when habits exist;
  - Me shows the Replay link.

## Out of scope

- Push notifications, reminders, or an onboarding checklist.
- Analytics on drop-off.
