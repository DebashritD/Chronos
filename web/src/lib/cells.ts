import type { CellState, Color, Frequency } from '../api/types'

export const STATE_LABEL: Record<CellState, string> = {
  GREEN: 'Target hit',
  YELLOW: 'Minimum done',
  RED: 'Missed',
  PAUSED: 'Paused',
  PENDING: 'Not marked yet',
  GREY: 'Not marked',
  NOT_DUE: 'Not due',
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

export type MarkKind = 'GREEN' | 'YELLOW' | 'RED' | 'OPEN' | 'FUTURE' | 'PAUSED'

/** The shape for a cell: colours as themselves, unmarked as an open ring (fainter once it's in the future). */
export function markKind(state: CellState, future: boolean): MarkKind | null {
  switch (state) {
    case 'GREEN':
    case 'YELLOW':
    case 'RED':
      return state
    case 'PAUSED':
      return 'PAUSED'
    case 'NOT_DUE':
      return null
    case 'PENDING':
    case 'GREY':
      return future ? 'FUTURE' : 'OPEN'
  }
}
