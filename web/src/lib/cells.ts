import type { CellState, Color, Frequency, HabitTexts } from '../api/types'

export const STATE_LABEL: Record<CellState, string> = {
  GREEN: 'Target hit',
  YELLOW: 'Minimum done',
  RED: 'Missed',
  PAUSED: 'Paused',
  PENDING: 'Not marked yet',
  GREY: 'Not marked',
  NOT_DUE: 'Not due',
}

/** Tailwind classes for a cell's fill (see the colors in index.css). */
export function cellClass(state: CellState): string {
  switch (state) {
    case 'GREEN':
      return 'bg-cell-green'
    case 'YELLOW':
      return 'bg-cell-yellow'
    case 'RED':
      return 'bg-cell-red'
    case 'GREY':
      return 'bg-cell-grey'
    case 'PENDING':
      return 'border-[1.5px] border-outline'
    case 'PAUSED':
      return 'cell-paused'
    case 'NOT_DUE':
      return 'bg-transparent'
  }
}

export function isColor(state: CellState): state is Color {
  return state === 'GREEN' || state === 'YELLOW' || state === 'RED'
}

export function frequencyLabel(frequency: Frequency, intervalDays?: number | null): string {
  switch (frequency) {
    case 'DAILY':
      return 'Daily'
    case 'WEEKLY':
      return 'Weekly'
    case 'EVERY_N_DAYS':
      return `Every ${intervalDays} days`
  }
}

/** "Daily · 1 page → 20 pages" */
export function habitSummary(
  habit: Pick<HabitTexts, 'minText' | 'targetText'> & { frequency: Frequency; intervalDays?: number | null },
): string {
  return `${frequencyLabel(habit.frequency, habit.intervalDays)} · ${habit.minText} → ${habit.targetText}`
}
