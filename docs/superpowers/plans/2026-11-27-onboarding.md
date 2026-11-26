# Onboarding Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every new account goes through a six-screen intro at `/welcome` and leaves it with at least one real habit.

**Architecture:**
- A nullable `onboarded_at` column backs a `Me.onboarded` flag, which is set by `POST /api/auth/me/onboarded`.
- On the web side, `RequireAuth` around `Shell` redirects users who are not onboarded to `/welcome`.
- `/welcome` renders `OnboardingFlow`, which steps through screen components in `web/src/features/onboarding/`.
- The practice and playground screens use local state only.

**Tech Stack:**
- API: Spring Boot, JdbcClient, Flyway, MockMvc with Testcontainers.
- Web: React 19, react-router, TanStack Query, Tailwind v4, Vitest with Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-27-onboarding-design.md`. Mockup: `.superpowers/mockups/onboarding.html`.

## Global Constraints

- The mockup copy is final. Use these strings exactly:
  - "Aim for no reds, not perfect days."
  - "Every habit has two levels."
  - "Marking is one tap."
  - "Minimums keep streaks alive."
  - "Start with one habit."
  - "Keep it one tap away."
- Starters: Read 5 pages/20 pages, Walk 10 min/30 min, Workout 10 min/45 min, Meditate 2 min/10 min, Stretch 1 stretch/15 min.
- Only `me.onboarded === false` redirects. A missing field (an older stored Me) counts as onboarded.
- Replay (`/welcome?replay`) never calls `POST /api/auth/me/onboarded`.
- Use the existing tokens and classes from `lib/ui.ts`, plus the `Mark` and `Stamp` components. No new colours.
- Commands:
  - web, from `web/`: `npx vitest run`, `npx tsc -b`, `npm run lint`;
  - API, from `api/`: `DOCKER_HOST=unix://$HOME/.rd/docker.sock TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock ./gradlew test`.

---

### Task 1: API onboarded flag

**Files:**
- Create: `api/src/main/resources/db/migration/V4__onboarded.sql`
- Modify:
  - `core/user/User.java`
  - `core/user/UserRepository.java`
  - `core/auth/MeResponse.java`
  - `core/auth/AuthController.java`
- Test: `api/src/test/java/com/chronos/core/auth/AuthIntegrationTest.java`

**Interfaces:**
- Produces:
  - `GET /api/auth/me` returns `{ username, timezone, maxYellows, onboarded: boolean }`;
  - `POST /api/auth/me/onboarded` returns 204.

- [ ] **Step 1: Write the failing tests.** Covers `newUserIsNotOnboardedUntilMarked`, `markOnboardedIsIdempotent` (the timestamp is unchanged by a second call), and `markOnboardedRequiresAuthentication`.
- [ ] **Step 2: Run the tests.** Expect failures: there is no `onboarded` field and the endpoint returns 404.
- [ ] **Step 3: Write the migration.**

```sql
ALTER TABLE app_user ADD COLUMN onboarded_at TIMESTAMPTZ;
UPDATE app_user SET onboarded_at = now();
```

- [ ] **Step 4: Implement the API changes.**
  - `User` gets `OffsetDateTime onboardedAt`.
  - Repository: `markOnboarded(id)` runs `UPDATE app_user SET onboarded_at = now() WHERE id = :id AND onboarded_at IS NULL`.
  - `MeResponse` gets `boolean onboarded = user.onboardedAt() != null`.
  - Controller:

```java
@PostMapping("/me/onboarded") @ResponseStatus(NO_CONTENT)
void markOnboarded(@AuthenticationPrincipal AppUserPrincipal p) { users.markOnboarded(p.id()); }
```

- [ ] **Step 5: Run the API tests.** Expect a pass. Then commit.

### Task 2: Web flag, guard and route

**Files:**
- Modify:
  - `web/src/api/types.ts` (`Me.onboarded?: boolean`)
  - `web/src/test/utils.tsx` (`BOB.onboarded = true`)
  - `web/src/app/router.tsx`
- Create: `web/src/features/onboarding/api.ts`
- Test: `web/src/app/router.test.tsx`

**Interfaces:**
- Produces:
  - `useMarkOnboarded(): () => Promise<void>`, which POSTs and then calls `setMe({...me, onboarded: true})`;
  - the `/welcome` route.

- [ ] **Step 1: Write the failing router tests.**
  - Fetched me `{onboarded:false}` at `/` shows the "Aim for no reds" heading.
  - `{onboarded:true}` at `/welcome` redirects to Today.
  - `{onboarded:true}` at `/welcome?replay` shows the flow.
- [ ] **Step 2: Implement.**
  - In `RequireAuth`, add a `shell` prop: when `me.onboarded === false`, redirect `<Navigate to="/welcome" replace/>`.
  - New route `/welcome` uses `<RequireAuth><WelcomeRoute/></RequireAuth>`. `WelcomeRoute` redirects onboarded users to `/` unless `?replay` is present.
- [ ] **Step 3: Run the tests and commit** (after Task 3, which provides the heading).

### Task 3: Flow, plus the Welcome, How, FirstHabit and Install screens

**Files:**
- Create, all in `web/src/features/onboarding/`:
  - `OnboardingFlow.tsx` (step state, dots, Skip, layout)
  - `WelcomeStep.tsx`
  - `HowStep.tsx`
  - `FirstHabitStep.tsx`
  - `InstallStep.tsx`
  - `starters.ts`
- Test: `OnboardingFlow.test.tsx`

**Interfaces:**
- Each step gets `{ onNext(): void }`.
- `FirstHabitStep` gets `{ replay: boolean; onDone(name: string | null): void }`.
- `InstallStep` gets `{ habitName: string | null; onFinish(): void }`.

- [ ] **Step 1: Write the failing tests.**
  - Skip on step 1 jumps to "Start with one habit." and there is no Skip there.
  - Create is disabled until name, minimum and target are filled; picking the Workout starter fills 10 min/45 min.
  - Create POSTs `/api/habits` `{name, minText, targetText, frequency:'DAILY', yellowCap:true}` and then POSTs `/api/auth/me/onboarded`, then shows "Workout is on your Today."
  - A create error keeps the values and shows an alert.
  - Replay with existing habits shows Done and never calls onboarded.
  - "Go to Today" navigates to `/`.
- [ ] **Step 2: Implement the screens** with the mockup's copy and the `lib/ui` classes.
  - FirstHabitStep queries `useHabits()`. If habits exist, it shows "You already have habits" with a Done button. Outside replay, Done calls markOnboarded first.
  - A markOnboarded failure after a successful create is swallowed and the flow continues.
- [ ] **Step 3: Run the tests and commit.**

### Task 4: Practice tap screen

**Files:**
- Create: `web/src/features/onboarding/PracticeStep.tsx`
- Test: `PracticeStep.test.tsx`

The card copies HabitCard's markup and classes, but uses local `useState<Color|null>`. Target or Minimum renders a stamped row (`Stamp`, with `pressed`). Missed renders the "That's honest. Tomorrow is a fresh start." line. Tapping the name or row opens a local picker dialog: three choices with SAVED, "+ Add note", a textarea, Clear, and Save note. There are three hint steps. Next is disabled until the first mark. Footer: "practice only · nothing is saved".

- [ ] Tests:
  - Next is disabled at first, and tapping Target enables it and shows the stamp.
  - Opening the row shows the picker, and Clear returns the row to the buttons.
  - No fetch calls are made.
- [ ] Implement, run the tests, commit.

### Task 5: Progress playground screen

**Files:**
- Create:
  - `web/src/features/onboarding/playground.ts`: a pure `playgroundStreak(marks: Color[], limit: number): { now: number; best: number; reason: string }`, ported from the mockup's `calc()`.
  - `PlaygroundStep.tsx`
- Test: `playground.test.ts`, `PlaygroundStep.test.tsx`

The step shows:
- the week grid Mon 16 to Sun 22, with marks and run lines;
- dimming before the last red;
- a Streaks row "NOW · BEST";
- the reason line;
- a Stepper (`app/Stepper.tsx`) for 1–7, starting from `me.maxYellows`.

On Next, if the limit changed, it sends `PUT /api/auth/me {maxYellows}` and calls `setMe`. On error it shows an alert and stays.

- [ ] Tests:
  - the restart-reason maths;
  - tapping a cell cycles its mark;
  - Next with a changed limit PUTs it, and an unchanged limit sends no request.
- [ ] Implement, run the tests, commit.

### Task 6: Replay link and docs

- [ ] Add a "Replay intro" link to `/welcome?replay` in the Habits section of `AccountPage`, plus a test.
- [ ] Add a short Onboarding section to DESIGN.md.
- [ ] Run the full web suite, tsc, lint and the API tests, and take a Playwright screenshot of `/welcome`. Commit.
