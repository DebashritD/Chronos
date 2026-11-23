# Yellow Cap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a streak survive at most N consecutive yellows (per-user N, per-habit on/off), and warn the user when they reach N.

**Architecture:** The rule lives in `HabitTimeline.streak(Integer maxYellows)`; `/api/stats/streaks` exposes `yellowRun` and `yellowLimit`. The web never re-derives the rule: after a YELLOW save, `useSaveCheckIn` reads the refreshed streaks and notifies a `YellowLimitProvider` (mounted app-wide) that shows the dialog.

**Tech Stack:** Spring Boot 4 / Java 21 / JdbcClient / Flyway / Postgres; React 19 + TanStack Query v5 + Tailwind v4; JUnit 5 + Testcontainers; Vitest + Testing Library.

Spec: `docs/superpowers/specs/2026-11-23-yellow-cap-design.md`

## Global Constraints

- N (`maxYellows`): per user, default 2, range 1–7.
- `yellowCap`: per habit, default true (existing habits included).
- (N+1)th consecutive yellow → streak 1, yellowRun 1. GREEN → yellowRun 0. RED/GREY → streak 0, yellowRun 0. PAUSED/PENDING/NOT_DUE skipped.
- Dialog text: "You've hit N yellows in a row on <habit>. Next time go green, or the streak starts over."
- oxlint `react/only-export-components`: `.tsx` files export components only; hooks/contexts/helpers go in `.ts`.
- Commits end with `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`. Never push without asking.

## Commands

- API tests (from `api/`): `export DOCKER_HOST=unix://$HOME/.rd/docker.sock TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock; ./gradlew test -q --tests '<Class>'`. Check `build/test-results/test/*.xml` for failures.
- Web (from `web/`): `npx vitest run <path>`; `npm run lint && npm run build`.

---

### Task 1: Streak rule in the domain

**Files:**
- Modify: `api/src/main/java/com/chronos/habit/domain/Streak.java`
- Modify: `api/src/main/java/com/chronos/habit/domain/HabitTimeline.java:65-80`
- Modify: `api/src/main/java/com/chronos/stats/StatsService.java:122` (call `streak(null)` for now so it compiles)
- Test: `api/src/test/java/com/chronos/habit/domain/HabitTimelineTest.java`

**Interfaces:**
- Produces: `record Streak(int current, int best, int yellowRun)`; `Streak HabitTimeline.streak(Integer maxYellows)` (null = no cap).

- [ ] **Step 1: Update existing tests and add new ones**

Replace the two existing streak tests and add four:

```java
    @Test
    void streakCountsGreenAndYellowAndResetsOnRedOrGrey() {
        var timeline = daily(nov(10), Map.of(
                nov(10), Color.GREEN, nov(11), Color.YELLOW, nov(12), Color.RED,
                nov(13), Color.GREEN, nov(14), Color.GREEN, nov(15), Color.YELLOW,
                nov(17), Color.GREEN), List.of());

        assertThat(timeline.streak(null)).isEqualTo(new Streak(1, 3, 0));
    }

    @Test
    void streakSkipsPausedPeriodsAndCountsAMarkedCurrentPeriod() {
        var timeline = daily(nov(14), Map.of(nov(14), Color.GREEN, nov(17), Color.GREEN, TODAY, Color.YELLOW),
                List.of(new DateRange(nov(15), nov(16))));

        assertThat(timeline.streak(null)).isEqualTo(new Streak(3, 3, 1));
    }

    @Test
    void yellowCapAllowsNYellowsInARowAndGreenClearsTheRun() {
        var timeline = daily(nov(14), Map.of(nov(14), Color.GREEN, nov(15), Color.YELLOW, nov(16), Color.YELLOW,
                nov(17), Color.GREEN, TODAY, Color.YELLOW), List.of());

        assertThat(timeline.streak(2)).isEqualTo(new Streak(5, 5, 1));
    }

    @Test
    void yellowBeyondTheCapStartsANewStreakAtOne() {
        var colors = Map.of(nov(14), Color.GREEN, nov(15), Color.YELLOW, nov(16), Color.YELLOW, nov(17), Color.YELLOW);

        assertThat(daily(nov(14), colors, List.of()).streak(2)).isEqualTo(new Streak(1, 3, 1));
        assertThat(daily(nov(14), colors, List.of()).streak(null)).isEqualTo(new Streak(4, 4, 3));
    }

    @Test
    void redClearsTheYellowRun() {
        var timeline = daily(nov(14), Map.of(nov(14), Color.YELLOW, nov(15), Color.YELLOW, nov(16), Color.RED,
                nov(17), Color.YELLOW, TODAY, Color.YELLOW), List.of());

        assertThat(timeline.streak(2)).isEqualTo(new Streak(2, 2, 2));
    }

    @Test
    void pausedPeriodsNeitherExtendNorClearTheYellowRun() {
        var timeline = daily(nov(14), Map.of(nov(14), Color.YELLOW, nov(16), Color.YELLOW, nov(17), Color.YELLOW),
                List.of(new DateRange(nov(15), nov(15))));

        assertThat(timeline.streak(2)).isEqualTo(new Streak(1, 2, 1));
    }
```

- [ ] **Step 2: Run to verify failure** — `./gradlew test -q --tests 'com.chronos.habit.domain.HabitTimelineTest'` → compile failure (`streak(Integer)` / 3-arg `Streak`).

- [ ] **Step 3: Implement**

`Streak.java`:
```java
public record Streak(int current, int best, int yellowRun) {
}
```

`HabitTimeline.java` (replace `streak()`):
```java
    /** {@code maxYellows} caps consecutive yellows: one more starts a new streak at 1. Null means no cap. */
    public Streak streak(Integer maxYellows) {
        int current = 0;
        int best = 0;
        int yellowRun = 0;
        for (LocalDate start : schedule.periodStartsBetween(schedule.firstPeriodStart(), today)) {
            switch (stateOf(start)) {
                case GREEN -> {
                    current++;
                    yellowRun = 0;
                }
                case YELLOW -> {
                    yellowRun++;
                    if (maxYellows != null && yellowRun > maxYellows) {
                        current = 1;
                        yellowRun = 1;
                    } else {
                        current++;
                    }
                }
                case RED, GREY -> {
                    current = 0;
                    yellowRun = 0;
                }
                case PAUSED, PENDING, NOT_DUE -> {
                }
            }
            best = Math.max(best, current);
        }
        return new Streak(current, best, yellowRun);
    }
```

`StatsService.java:122`: `var streak = byId.get(h.id()).streak(null);`

- [ ] **Step 4: Run tests** — same command → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(api): cap consecutive yellows in streaks"` (with trailer).

---

### Task 2: Persist and expose maxYellows / yellowCap

**Files:**
- Create: `api/src/main/resources/db/migration/V2__yellow_cap.sql`
- Modify: `core/user/User.java`, `core/user/UserRepository.java`, `core/auth/MeResponse.java`, `core/auth/UpdateMeRequest.java`, `core/auth/AccountService.java:42-55`
- Modify: `habit/Habit.java`, `habit/HabitRepository.java`, `habit/CreateHabitRequest.java`, `habit/UpdateHabitRequest.java`, `habit/HabitResponse.java`, `habit/HabitService.java:53-63`
- Modify: `stats/StreakResponse.java`, `stats/StatsService.java:116-126`
- Test: `core/auth/AuthIntegrationTest.java`, `habit/HabitIntegrationTest.java`, `stats/StatsIntegrationTest.java`
(all under `api/src/main/java/com/chronos/` or `api/src/test/java/com/chronos/`)

**Interfaces:**
- Consumes: `HabitTimeline.streak(Integer)`, `Streak.yellowRun()`.
- Produces (JSON): `Me.maxYellows: number`; `PUT /api/auth/me {maxYellows?}`; `Habit.yellowCap: boolean`; create/update accept `yellowCap?`; `Streak.yellowRun: number`, `Streak.yellowLimit: number | null`.

- [ ] **Step 1: Failing integration tests**

`AuthIntegrationTest`:
```java
    @Test
    void updateMeSavesMaxYellowsWithinOneToSeven() throws Exception {
        var bob = createUser("bob");

        mvc.perform(get("/api/auth/me").with(as(bob)))
                .andExpect(jsonPath("$.maxYellows").value(2));
        mvc.perform(put("/api/auth/me").with(as(bob)).with(xsrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"maxYellows\": 3}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maxYellows").value(3));
        mvc.perform(put("/api/auth/me").with(as(bob)).with(xsrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"maxYellows\": 8}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION"));
    }
```

`HabitIntegrationTest` (uses the file's existing `create(String)` helper):
```java
    @Test
    void yellowCapDefaultsOnAndCanBeSwitchedOff() throws Exception {
        String body = mvc.perform(create("""
                        {"name": "Read", "minText": "1 page", "targetText": "20 pages", "frequency": "DAILY"}
                        """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.yellowCap").value(true))
                .andReturn().getResponse().getContentAsString();
        long id = Long.parseLong(body.replaceAll(".*\"id\":(\\d+).*", "$1"));

        mvc.perform(put("/api/habits/{id}", id).with(as(bob)).with(xsrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Read", "minText": "1 page", "targetText": "20 pages", "yellowCap": false}
                                """))
                .andExpect(jsonPath("$.yellowCap").value(false));
        mvc.perform(put("/api/habits/{id}", id).with(as(bob)).with(xsrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Read", "minText": "1 page", "targetText": "20 pages"}
                                """))
                .andExpect(jsonPath("$.yellowCap").value(false));
    }
```

`StatsIntegrationTest`:
```java
    @Test
    void streaksApplyTheUsersYellowCapToCappedHabitsOnly() throws Exception {
        long capped = insertHabit(bob, "Read", "DAILY", null, nov(15));
        long free = insertHabit(bob, "Run", "DAILY", null, nov(15));
        jdbc.sql("UPDATE habit SET yellow_cap = false WHERE id = :id").param("id", free).update();
        for (long habit : new long[] {capped, free}) {
            insertCheckIn(habit, nov(15), "YELLOW");
            insertCheckIn(habit, nov(16), "YELLOW");
            insertCheckIn(habit, nov(17), "YELLOW");
        }

        mvc.perform(get("/api/stats/streaks").with(as(bob)))
                .andExpect(jsonPath("$[0].current").value(1))
                .andExpect(jsonPath("$[0].yellowRun").value(1))
                .andExpect(jsonPath("$[0].yellowLimit").value(2))
                .andExpect(jsonPath("$[1].current").value(3))
                .andExpect(jsonPath("$[1].yellowRun").value(3))
                .andExpect(jsonPath("$[1].yellowLimit").doesNotExist());
    }
```
(`doesNotExist()` passes for a JSON `null` value in Spring's JsonPath matcher.)

- [ ] **Step 2: Run** `./gradlew test -q --tests '*AuthIntegrationTest' --tests '*HabitIntegrationTest' --tests '*StatsIntegrationTest'` → the three new tests FAIL.

- [ ] **Step 3: Implement**

`V2__yellow_cap.sql`:
```sql
ALTER TABLE app_user ADD COLUMN max_yellows INT NOT NULL DEFAULT 2 CHECK (max_yellows BETWEEN 1 AND 7);
ALTER TABLE habit ADD COLUMN yellow_cap BOOLEAN NOT NULL DEFAULT TRUE;
```

`User.java`: `public record User(long id, String username, String passwordHash, String timezone, OffsetDateTime createdAt, int maxYellows)`.

`UserRepository.java`:
```java
    public void updateMaxYellows(long id, int maxYellows) {
        jdbc.sql("UPDATE app_user SET max_yellows = :maxYellows WHERE id = :id")
                .param("id", id).param("maxYellows", maxYellows).update();
    }
```

`MeResponse.java`: `record MeResponse(String username, String timezone, int maxYellows)`; `from` passes `user.maxYellows()`.

`UpdateMeRequest.java`: add component `@Min(1) @Max(7) Integer maxYellows` (imports `jakarta.validation.constraints.Min/Max`).

`AccountService.updateMe`, after the timezone block:
```java
        if (request.maxYellows() != null) {
            users.updateMaxYellows(userId, request.maxYellows());
        }
```

`Habit.java`: append component `boolean yellowCap` after `updatedAt`.

`CreateHabitRequest.java` / `UpdateHabitRequest.java`: append `Boolean yellowCap`.

`HabitRepository.insert`: add trailing param `boolean yellowCap`; SQL column list `..., start_date, yellow_cap` / values `..., :startDate, :yellowCap`; `.param("yellowCap", yellowCap)`. Add:
```java
    public void updateYellowCap(long habitId, boolean yellowCap) {
        jdbc.sql("UPDATE habit SET yellow_cap = :yellowCap, updated_at = now() WHERE id = :id")
                .param("id", habitId).param("yellowCap", yellowCap).update();
    }
```

`HabitService.create`: pass `request.yellowCap() == null || request.yellowCap()` as the new last argument. `HabitService.update`, after `updateTexts`:
```java
        if (request.yellowCap() != null) {
            habits.updateYellowCap(habitId, request.yellowCap());
        }
```

`HabitResponse.java`: append `boolean yellowCap`; `from` passes `h.yellowCap()`.

`StreakResponse.java`: `record StreakResponse(long habitId, String name, int current, int best, int yellowRun, Integer yellowLimit)`.

`StatsService.streaks`:
```java
    public List<StreakResponse> streaks(long userId) {
        LocalDate today = userService.today(userId);
        int maxYellows = userService.get(userId).maxYellows();
        List<Habit> habits = habitService.list(userId, null);
        Map<Long, HabitTimeline> byId = timelines.load(habits, today);
        return habits.stream()
                .map(h -> {
                    Integer limit = h.yellowCap() ? maxYellows : null;
                    var streak = byId.get(h.id()).streak(limit);
                    return new StreakResponse(h.id(), h.name(), streak.current(), streak.best(), streak.yellowRun(), limit);
                })
                .toList();
    }
```

- [ ] **Step 4: Run the full API suite** `./gradlew test -q` → all PASS (check XML results).
- [ ] **Step 5: Commit** — `feat(api): per-user yellow limit and per-habit yellow cap`.

---

### Task 3: Web settings — Account N and habit toggle

**Files:**
- Modify: `web/src/api/types.ts`, `web/src/test/utils.tsx` (BOB gets `maxYellows: 2`)
- Modify: `web/src/features/habits/api.ts`, `HabitForm.tsx`, `HabitsPage.tsx`
- Modify: `web/src/features/account/AccountPage.tsx`
- Modify fixtures: `web/src/features/today/TodayPage.test.tsx`, `web/src/features/progress/WeekPanel.test.tsx` (each `Streak` gets `yellowRun: 0, yellowLimit: 2`), `HabitsPage.test.tsx` (habits get `yellowCap: true`)
- Test: `HabitsPage.test.tsx`, `AccountPage.test.tsx`

**Interfaces:**
- Produces: `Me.maxYellows: number`; `Habit.yellowCap: boolean`; `NewHabit.yellowCap: boolean`; `HabitUpdate = HabitTexts & { yellowCap: boolean }`; `Streak.yellowRun: number`, `Streak.yellowLimit: number | null`.

- [ ] **Step 1: Failing tests**

`HabitsPage.test.tsx` — in `creates an every-N-days habit` the expected body becomes `{ name: 'Run', minText: '1 km', targetText: '5 km', frequency: 'EVERY_N_DAYS', intervalDays: 3, yellowCap: true }`. Rename `edits only the texts` → `edits the texts and the yellow limit`; before Save add `await user.click(screen.getByLabelText('Limit yellows in a row'))`; expected body `{ name: 'Read more', minText: '1 page', targetText: '20 pages', yellowCap: false }`. Add to `lists current habits…`: `expect(within(screen.getByRole('listitem', { name: 'Read' })).getByText('≤2 yellows')).toBeInTheDocument()`.

`AccountPage.test.tsx`:
```tsx
  it('saves how many yellows in a row keep a streak', async () => {
    const fetchMock = stubApi(({ method }) =>
      method === 'PUT' ? jsonResponse({ username: 'bob', timezone: 'Asia/Kolkata', maxYellows: 3 }) : undefined,
    )
    const { user } = renderWithProviders(<AccountPage />, { route: '/settings' })

    const input = screen.getByLabelText('Yellows allowed in a row')
    expect(input).toHaveValue(2)
    await user.clear(input)
    await user.type(input, '3')
    await user.click(screen.getByRole('button', { name: 'Save streak rule' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Streak rule saved')
    expect(requests(fetchMock)).toContainEqual({ method: 'PUT', url: '/api/auth/me', body: { maxYellows: 3 } })
  })
```

- [ ] **Step 2: Run** `npx vitest run src/features/habits src/features/account` → FAIL.

- [ ] **Step 3: Implement**

`types.ts`: `Me` add `maxYellows: number`; `NewHabit` add `yellowCap: boolean`; `Habit` add `yellowCap: boolean`; add `export type HabitUpdate = HabitTexts & { yellowCap: boolean }`; `Streak` add `yellowRun: number` and `/** N while this habit's yellow cap is on, else null. */ yellowLimit: number | null`.

`habits/api.ts` `useUpdateHabit`: `mutationFn: ({ id, ...body }: HabitUpdate & { id: number }) => api.put<Habit>(\`/api/habits/${id}\`, body)`.

`HabitForm.tsx`: `const { me } = useSession()` (from `../auth/session`); `const [yellowCap, setYellowCap] = useState(habit?.yellowCap ?? true)`; include `yellowCap` in the submitted values. Before the error line (visible for create and edit):
```tsx
      <label className="mb-3 flex items-start gap-3 rounded-[14px] bg-surface px-3 py-2.5">
        <input type="checkbox" checked={yellowCap} onChange={(e) => setYellowCap(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-cell-yellow" />
        <span>
          <span className="block text-[14px] font-medium text-fg">Limit yellows in a row</span>
          <span className="block text-[12px] text-muted">Up to {me?.maxYellows ?? 2} in a row keep your streak.</span>
        </span>
      </label>
```
Update the `habit` prop doc to "edits this habit's texts and yellow limit".

`HabitsPage.tsx`: edit `onSubmit={async ({ name, minText, targetText, yellowCap }) => { await updateHabit.mutateAsync({ id: habit.id, name, minText, targetText, yellowCap }) …`. Get `const { me } = useSession()`; next to the Paused chip:
```tsx
            {habit.yellowCap && (
              <span className="rounded-full bg-cell-yellow/15 px-2 py-0.5 text-[11px] font-semibold text-cell-yellow">
                ≤{me?.maxYellows ?? 2} yellows
              </span>
            )}
```

`AccountPage.tsx`: state `const [maxYellows, setMaxYellows] = useState(String(me?.maxYellows ?? 2))`, `const [ruleFeedback, setRuleFeedback] = useState<Feedback>(null)`;
```tsx
  async function saveStreakRule(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setRuleFeedback(null)
    try {
      setMe(await api.put<Me>('/api/auth/me', { maxYellows: Number(maxYellows) }))
      await queryClient.invalidateQueries({ queryKey: ['stats'] })
      setRuleFeedback({ kind: 'ok', text: 'Streak rule saved' })
    } catch (err) {
      setRuleFeedback({ kind: 'error', text: messageFor(err) })
    }
  }
```
Form between Timezone and Change password:
```tsx
      <form className={`${card} mb-4`} onSubmit={(event) => void saveStreakRule(event)}>
        <h2 className={cardTitle}>Streak rules</h2>
        <label htmlFor="max-yellows" className={label}>Yellows allowed in a row</label>
        <input id="max-yellows" type="number" min={1} max={7} required value={maxYellows}
          onChange={(e) => setMaxYellows(e.target.value)} className={inputClass} />
        <p className="mt-2 text-xs text-dim">For habits with the limit on, one more yellow starts the streak over.</p>
        <button type="submit" className={`${primaryButton} mt-4`}>Save streak rule</button>
        <FeedbackLine feedback={ruleFeedback} />
      </form>
```

Update fixtures listed above so `npm run build` type-checks.

- [ ] **Step 4: Run** `npx vitest run && npm run lint && npm run build` → PASS.
- [ ] **Step 5: Commit** — `feat(web): yellow limit setting on account and habits`.

---

### Task 4: Web dialog and Today badge

**Files:**
- Create: `web/src/lib/yellowLimit.ts`, `web/src/app/YellowLimitProvider.tsx`
- Modify: `web/src/features/stats/api.ts`, `web/src/main.tsx`, `web/src/test/utils.tsx`
- Modify: `web/src/features/today/HabitCard.tsx`, `TodayPage.tsx`
- Test: `TodayPage.test.tsx`, `WeekPanel.test.tsx`

**Interfaces:**
- Consumes: `Streak.yellowRun`, `Streak.yellowLimit`.
- Produces: `atYellowLimit(s: Streak | undefined): s is Streak & { yellowLimit: number }`; `YellowLimitContext`; `useNotifyYellowLimit(): (hit: { name: string; limit: number }) => void`; `<YellowLimitProvider>`; `HabitCard` prop `yellowLimit?: number`.

- [ ] **Step 1: Failing tests**

`TodayPage.test.tsx` (streaks for Read flip to the limit after the PUT):
```tsx
  it('warns when a yellow uses up the limit and badges the card', async () => {
    let readRun = 1
    api((r) => {
      if (r.method === 'PUT') {
        readRun = 2
        return jsonResponse({ periodStart: '2026-11-18', color: 'YELLOW', note: 'ch 3' })
      }
      if (r.url === '/api/stats/streaks')
        return jsonResponse([{ habitId: 1, name: 'Read', current: 3, best: 9, yellowRun: readRun, yellowLimit: 2 }])
      return undefined
    })
    const { user } = renderWithProviders(<TodayPage />)

    const read = await screen.findByRole('article', { name: 'Read' })
    expect(within(read).queryByText('2/2 yellows')).not.toBeInTheDocument()
    await user.click(within(read).getByRole('button', { name: 'Minimum' }))

    const dialog = await screen.findByRole('alertdialog', { name: 'Yellow limit reached' })
    expect(dialog).toHaveTextContent("You've hit 2 yellows in a row on Read. Next time go green, or the streak starts over.")
    await user.click(within(dialog).getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(within(read).getByText('2/2 yellows')).toBeInTheDocument()
  })
```

`WeekPanel.test.tsx`:
```tsx
  it('warns when a yellow saved from the grid uses up the limit', async () => {
    let run = 1
    api((r) => {
      if (r.method === 'PUT') {
        run = 2
        return jsonResponse({ periodStart: '2026-11-18', color: 'YELLOW', note: null })
      }
      if (r.url === '/api/stats/streaks')
        return jsonResponse([{ habitId: 1, name: 'Read', current: 3, best: 9, yellowRun: run, yellowLimit: 2 }])
      return undefined
    })
    const { user } = renderWithProviders(<WeekPanel />, { route: '/progress' })

    await user.click(await screen.findByRole('button', { name: 'Read, Wed 18 Nov, Not marked yet' }))
    await user.click(screen.getByRole('button', { name: /^Minimum done/ }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alertdialog', { name: 'Yellow limit reached' })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run** `npx vitest run src/features/today src/features/progress` → the two new tests FAIL.

- [ ] **Step 3: Implement**

`lib/yellowLimit.ts`:
```ts
import { createContext, useContext } from 'react'
import type { Streak } from '../api/types'

export interface YellowLimitHit {
  name: string
  limit: number
}

export const YellowLimitContext = createContext<(hit: YellowLimitHit) => void>(() => {})

export function useNotifyYellowLimit(): (hit: YellowLimitHit) => void {
  return useContext(YellowLimitContext)
}

/** True while the habit has used every yellow it may have in a row; the next one restarts its streak. */
export function atYellowLimit(streak: Streak | undefined): streak is Streak & { yellowLimit: number } {
  return streak !== undefined && streak.yellowLimit !== null && streak.yellowRun >= streak.yellowLimit
}
```

`app/YellowLimitProvider.tsx`:
```tsx
import { useState, type ReactNode } from 'react'
import { YellowLimitContext, type YellowLimitHit } from '../lib/yellowLimit'
import { primaryButton } from '../lib/ui'

/** App-wide so the warning outlives the picker or card that saved the yellow. */
export function YellowLimitProvider({ children }: { children: ReactNode }) {
  const [hit, setHit] = useState<YellowLimitHit | null>(null)
  return (
    <YellowLimitContext.Provider value={setHit}>
      {children}
      {hit && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-labelledby="yellow-limit-title" aria-describedby="yellow-limit-text"
            className="w-full max-w-sm rounded-[28px] border border-line bg-card p-6 text-center">
            <span className="mx-auto mb-3 block h-10 w-10 rounded-xl bg-cell-yellow" aria-hidden="true" />
            <h2 id="yellow-limit-title" className="text-[20px] font-extrabold text-fg">Yellow limit reached</h2>
            <p id="yellow-limit-text" className="mt-2 text-[15px] text-muted">
              You've hit {hit.limit} yellows in a row on {hit.name}. Next time go green, or the streak starts over.
            </p>
            <button type="button" autoFocus onClick={() => setHit(null)} className={`${primaryButton} mt-5 w-full`}>
              Got it
            </button>
          </div>
        </div>
      )}
    </YellowLimitContext.Provider>
  )
}

export default YellowLimitProvider
```

`stats/api.ts`:
```ts
const streaksQuery = { queryKey: ['stats', 'streaks'], queryFn: () => api.get<Streak[]>('/api/stats/streaks') }

export function useStreaks() {
  return useQuery(streaksQuery)
}

/**
 * Returning the invalidation promise makes `mutateAsync` resolve after week, month and streaks have refetched.
 * A yellow that brings the habit's run up to its limit raises the yellow-limit dialog (not when only the note changed).
 */
export function useSaveCheckIn() {
  const queryClient = useQueryClient()
  const notifyYellowLimit = useNotifyYellowLimit()
  return useMutation({
    mutationFn: ({ color, note, ...key }: CheckInKey & { color: Color; note: string | null }) =>
      api.put(checkInPath(key), { color, note }),
    onMutate: ({ habitId }) => ({
      runBefore: queryClient.getQueryData<Streak[]>(streaksQuery.queryKey)?.find((s) => s.habitId === habitId)?.yellowRun,
    }),
    onSuccess: async (_data, { habitId, color }, context) => {
      await queryClient.invalidateQueries({ queryKey: ['stats'] })
      if (color !== 'YELLOW') return
      const streak = (await queryClient.ensureQueryData(streaksQuery)).find((s) => s.habitId === habitId)
      if (atYellowLimit(streak) && streak.yellowRun !== context?.runBefore) {
        notifyYellowLimit({ name: streak.name, limit: streak.yellowLimit })
      }
    },
  })
}
```
(imports: `atYellowLimit, useNotifyYellowLimit` from `../../lib/yellowLimit`.)

`main.tsx`: wrap `<App />` in `<YellowLimitProvider>` (inside `SessionProvider`). `test/utils.tsx`: wrap `<Routes>…</Routes>` in `<YellowLimitProvider>`.

`HabitCard.tsx`: add prop `/** N while this habit is at its yellow limit. */ yellowLimit?: number`. In the bottom row, replace the left slot with a group:
```tsx
        <span className="flex flex-wrap items-center gap-1.5">
          {timeLeft && (
            <span data-tone={tone}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${TONE_CLASS[tone]}`}>
              <Clock size={13} aria-hidden="true" />
              {timeLeft}
            </span>
          )}
          {yellowLimit !== undefined && (
            <span className="rounded-full bg-cell-yellow/15 px-2.5 py-1 text-[12px] font-semibold text-cell-yellow">
              {yellowLimit}/{yellowLimit} yellows
            </span>
          )}
        </span>
```

`TodayPage.tsx`: `const streakFor = (habitId: number) => streaks.data?.find((s) => s.habitId === habitId)`; pass `streak={streakFor(id)?.current}` and `yellowLimit={atYellowLimit(s) ? s.yellowLimit : undefined}` (compute `s` per item).

- [ ] **Step 4: Run** `npx vitest run && npm run lint && npm run build` → PASS.
- [ ] **Step 5: Commit** — `feat(web): yellow limit dialog and Today badge`.

---

### Task 5: Verify end to end

- [ ] Restart the local API (Flyway applies V2) and check in the browser: Account → Streak rules; create a habit (toggle on by default); mark yellows on Today and from Progress; dialog shows at N; badge visible; (N+1)th yellow → streak 1.
- [ ] Ask the user before pushing.
