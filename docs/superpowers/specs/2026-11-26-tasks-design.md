# Tasks: a to-do tab

Mockups: `~/Docspace/Chronos/Todo Mockups/tasks-tab.html` (and `.png`).

## Goal

One-off to-dos sit beside habits without touching the no-red game. Tasks never turn red, never count toward Progress, and never use the mark colours. A tick is drawn in ink.

## Navigation

- Tabs, in order: **Today · Tasks · Progress · Me**. Top nav, tab bar and tab swipes all follow `TABS` in `web/src/app/tabs.ts`.
- Habits stops being a tab. `/habits` stays as a route, opened from Me's **Manage habits** button. That page gets a "‹ Me" back link and keeps edit, pause, archive and the Archived list with Restore. Swiping does nothing on `/habits`, because it isn't a tab.
- Me (`/settings`) gets a **Habits** section above Timezone with:
  - a mono count, "4 active · 2 archived";
  - **+ New habit**, which opens the existing new-habit bottom sheet in place;
  - **Manage habits**, which goes to `/habits`.

## Today

- One line sits under the date, above the summary: "**3 tasks** left today", with "Tasks →" on the right. The whole row links to `/tasks`.
- The count is open tasks on Today: tasks with a `scheduledOn` date and no `doneOn`. Later tasks don't count.
- The line is hidden when the count is 0.

## Tasks tab (`/tasks`)

**Header:** an eyebrow with the weekday and date, the title "Tasks", and a mono "2 of 5 done" on the right. That count covers open tasks plus tasks done today.

**Open tasks**
- Shown oldest first, by `scheduledOn` and then `createdAt`.
- A task with an earlier `scheduledOn` shows a mono note under it, "carried N days" (N = today − `scheduledOn`, with "1 day" in the singular).

**Done tasks**
- Shown struck through and muted, under the open tasks.
- Only tasks done today are shown, so they clear at midnight in the user's timezone.
- A Later task ticked done also moves here.

**Tick box**
- A square box with a 1.5px ink outline, filled with an ink check when done.
- Tapping it toggles done; un-ticking moves the task back up.
- The tap target is at least 44px.

**Edit**
- Tapping the text turns it into an input.
- Enter or blur saves. Escape cancels. Saving an empty input cancels, so you delete with a swipe instead.

**Add**
- The last row reads "+ Add a task".
- While it's focused, Today/Later chips show (Today by default), and Enter adds the task and keeps focus.
- Text is trimmed and must be 1–200 characters.

**Swipe left** (on open tasks only)
- Past the first threshold, a "Move to Later" panel shows; releasing there moves the task to Later.
- Past the second threshold, the panel reads "Delete"; releasing there deletes the task and shows a toast with **Undo** for 5 seconds.
- Use the gesture rules already in the app: horizontal intent only, so vertical scrolling and tab swipes keep working. While a row is being swiped, the tab swipe doesn't fire.

**Later**
- An eyebrow "Later" with a mono count, listing Later tasks newest first.
- Each shows a mono "added 12 Nov" note and a dashed box.
- Its "Do today" link sets `scheduledOn` to today.
- Later tasks can be edited, deleted by swiping, and ticked done.
- The list shows the first 5, then a "N more" button that shows the rest.

**Empty states**
- No tasks at all: a short line, "Nothing to do. Add a task below.", with the add row.
- Later is hidden when empty.

## Data

Migration `V3__task.sql`:

```sql
CREATE TABLE task (
  id           UUID PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  text         VARCHAR(200) NOT NULL,
  scheduled_on DATE,          -- the day it was put on Today; NULL = Later
  done_on      DATE,          -- the user's local date when ticked; NULL = open
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX task_user_idx ON task (user_id);
```

- The phone makes the UUID, so tasks can be added offline.
- `done_on` is sent by the phone. A tick made at 23:59 and synced after midnight still counts as done that day.

## API (`com.chronos.task`)

**`GET /api/tasks`** returns the user's tasks, except those done before today in the user's timezone. Today comes from `UserService.today`. Each item is:

```json
{ "id": "uuid", "text": "…", "scheduledOn": "2026-11-26" | null, "doneOn": "2026-11-26" | null, "createdAt": "…" }
```

**`PUT /api/tasks/{id}`** takes `{ text, scheduledOn, doneOn, createdAt }`.
- It creates the task or replaces it, and sending it twice is harmless.
- `createdAt` is optional and only used when the task is first inserted (so an offline add or an Undo keeps its place). It is never later than the server's now; a later PUT never changes it.
- It returns 200 with the task.
- Text is trimmed and must be 1–200 characters.
- Each date must be no later than today + 1, to allow for timezone slack.
- An id owned by another user returns 404.

**`DELETE /api/tasks/{id}`** returns 204.
- A missing task also returns 204, so retries are safe.
- A task owned by another user returns 404.

Errors use the existing `ApiException` and `ErrorCode`.

## Web

`features/tasks/`:

- `api.ts`: the `Task` type and the `['tasks']` query.
- `queue.ts`: the offline mutation queue, modelled on `features/checkin/queue.ts`.
  - Mutation key `['task']`, scope `tasks`, so changes are sent in order.
  - Two operations: `put` (the full task) and `delete`.
  - Optimistic patch of `['tasks']` in `onMutate`.
  - Network errors retry without limit, and 5xx errors retry 8 times.
  - On an `ApiError`, show the toast "Couldn’t sync a task. Refreshed." and refetch.
  - Queued changes are persisted with the query cache and resume on restore.
  - Signing out discards them, alongside check-ins.
- `TasksPage.tsx`, `TaskRow.tsx` (tick, edit, swipe) and `AddTask.tsx`.
- `taskDates.ts`: the "carried N days" text and the done-today filter, using the phone's local date (the same helper Today uses).

**Elsewhere in the app**
- `SyncStatus` counts pending task changes as well as check-ins.
- `TodayPage` gets the tasks line.
- `AccountPage` gets the Habits section.
- `HabitsPage` gets the back link.
- `TABS` gets the new order.
- The router adds `/tasks` to the tab pages.

**Design records**
- DESIGN.md gains a Tasks entry covering the ink tick, the dashed Later box, and the rule that colour stays off tasks.
- PRODUCT.md's capabilities mention tasks. The user edits that file; we only suggest the line.

## Tests

**API** (`TaskControllerTest`):
- create, replace and repeated `PUT`;
- validation, covering text length and dates later than today + 1;
- tasks done before today are left out of GET, judged in the user's timezone;
- another user's task returns 404 on `PUT` and `DELETE`;
- a missing task returns 204 on `DELETE`.

**Web:**
- `TasksPage`:
  - add to Today and to Later;
  - tick and un-tick;
  - edit, including that an empty edit cancels;
  - "Do today";
  - carried note;
  - done tasks from before today are hidden;
  - swipe to Later, swipe to delete, and Undo.
- `queue`:
  - optimistic patch;
  - in-order sending;
  - rollback and toast on an `ApiError`;
  - discarded on sign-out.
- `TodayPage`: the line shows the right count and is hidden at 0.
- Tabs: the new order, and no swipe on `/habits`.
- `AccountPage`: the New habit sheet opens, and Manage habits links to `/habits`.

## Out of scope

Reordering by drag, picking a future date, notes on tasks, reminders, and tasks in Progress.
