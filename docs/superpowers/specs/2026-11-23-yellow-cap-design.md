# Yellow cap: at most N consecutive yellows per streak

## Goal
A streak tolerates at most N consecutive YELLOW periods. The (N+1)th consecutive yellow starts a new streak at 1. RED (and unmarked past periods) still reset the streak to 0.

## Decisions
- N is a single per-user setting (`maxYellows`), default 2, range 1–7, edited on the Account page.
- Each habit has an on/off flag `yellowCap`, default ON (also for existing habits), set when creating and editing a habit.
- A GREEN clears the yellow run. PAUSED / PENDING / NOT_DUE periods are skipped (neither extend nor reset the run).
- Streaks are computed, so changing N or a habit's flag recomputes history (current and best).

## Rule (`HabitTimeline.streak(Integer cap)`; `cap == null` = rule off)
| State | streak | yellowRun |
|---|---|---|
| GREEN | +1 | 0 |
| YELLOW, cap off or run+1 ≤ N | +1 | +1 |
| YELLOW, cap on and run+1 > N | 1 | 1 |
| RED / GREY | 0 | 0 |
| PAUSED / PENDING / NOT_DUE | unchanged | unchanged |

`best` is the max `streak` seen. `Streak` becomes `(current, best, yellowRun)`.

## Data
Migration `V2__yellow_cap.sql`:
- `app_user.max_yellows INT NOT NULL DEFAULT 2 CHECK (max_yellows BETWEEN 1 AND 7)`
- `habit.yellow_cap BOOLEAN NOT NULL DEFAULT TRUE`

## API
- `GET/PUT /api/auth/me`: `Me` gains `maxYellows`; PUT accepts optional `maxYellows` (1–7, validated); omitted keeps the current value.
- `POST /api/habits` and `PUT /api/habits/{id}`: optional `yellowCap` (default true on create; omitted on update keeps the current value). `HabitResponse` gains `yellowCap`.
- `GET /api/stats/streaks`: `StreakResponse` gains `yellowRun` and `yellowLimit` (N when the habit's cap is on, otherwise null).

## Web
- **Account**: "Streak rules" card: number input "Yellows allowed in a row" (1–7), saved via `PUT /api/auth/me`.
- **HabitForm** (create + edit): checkbox "Limit yellows in a row", default checked, hint "Up to N in a row keep your streak".
- **Habits tile**: small chip "≤N yellows" when `yellowCap`.
- **YellowLimitDialog** (shared): text "You've hit N yellows in a row on <habit>. Next time go green, or the streak starts over." with an OK button. Shown after a YELLOW save (Today card or Progress cell) when the refreshed streak has `yellowLimit != null && yellowRun >= yellowLimit` and `yellowRun` changed with this save (re-saving a note on a yellow does not re-show it).
- **Today HabitCard**: amber badge "N/N yellows" while `yellowLimit != null && yellowRun >= yellowLimit`.

## Testing
- `HabitTimeline` unit tests: cap off unchanged; run ≤ N keeps streak; (N+1)th yellow → streak 1; green resets run; red resets both; paused period skipped.
- API integration: `maxYellows` round-trip on `/me`; `yellowCap` on create/update; streak response fields.
- Web: form toggle sends `yellowCap`; Account saves `maxYellows`; dialog appears on Today and on Progress after the Nth yellow; badge shows at the limit.
