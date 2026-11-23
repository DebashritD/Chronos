# Compact week tiles — design

**Date:** 2026-11-24
**Status:** approved (mockup: B, name on top with a thin full-width strip)

## Problem

On Progress → Week, each habit tile is about 140px tall. The name sits above a row of 40–44px squares, so only three or four habits fit on a phone screen.

## Goal

Make each tile about half as tall by turning the day squares into a thin strip of pills, like the strip on the Today habit card. Everything stays tappable as before.

## Design

Only `web/src/features/progress/WeekTiles.tsx` and `WeekCellButton.tsx` change. `WeekGrid` (Today) keeps its squares. The change applies at every screen width.

- **Tile:** `rounded-card border border-line bg-card px-4 py-3`, replacing `p-4`.
- **Name row:** the name in 16px semibold. The frequency label from `subtitle(habit)` ("every 3 days", "weekly") follows on the same line as 12px `text-dim`, starting with a lowercase letter. The 🔥 streak stays on the right, shown only when above 0, with no change.
- **Strip:** sits `mt-1 -mb-1` below the name row and uses the same `grid grid-cols-7 gap-1.5` columns and the same `weekSegments` layout as today. Every-N-days and weekly periods still span their days.
  - **Hit area:** each segment is a 24px-tall (`h-6`) block. When the segment has a cell, that block is the `WeekCellButton`.
  - **Pill:** an 8px-tall (`h-2`), fully rounded, vertically centred child inside the block. It carries `cellClass(state)`:
    - not marked yet: outlined
    - not due: transparent
    - paused: striped
    - green, yellow or red: solid colour
  - **Segments with no cell:** a non-interactive `aria-hidden` 24px block holding an empty, not-due pill.
- **Button behaviour:** `WeekCellButton` is also used by `WeekGrid` on Today, which must not change. It gains an optional `pill?: boolean` prop (default `false`).
  - **When `pill` is true:** the button stays transparent, and the `cellClass(state)` fill and rounding move to an inner `aria-hidden` pill span. `shape` sets the button's size, as it does today.
  - **Unchanged:** the `aria-label`, `aria-current="date"`, `disabled` and dimming rules. The dimming and the press feedback (`active:scale-95`) apply to the button.
  - **Only caller:** `WeekTiles` is the only place that passes `pill`.
- **Today:** no ring on the pills. Today stays marked in the shared header (blue date and dot), which is unchanged.

## Out of scope

- Month view.
- The Today cards and the Today `WeekGrid`.
- Data and API.
- The shared weekday and date header.

## Testing

- Existing `WeekPanel` and `ProgressPage` tests must still pass. They query cells by accessible name, which doesn't change.
- Add one `WeekPanel` test: each cell button holds a single pill child that has the state's class, for example `bg-cell-green` for a green cell.
- No visual tests. Check by eye with a mobile screenshot against the dev server.
