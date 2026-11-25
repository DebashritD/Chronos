import type { CellState } from '../api/types'

/** Bright = in the current run: everything after the row's last miss (and the miss itself). Earlier marks are dim. */
export function brightness(states: readonly CellState[]): boolean[] {
  const lastRed = states.lastIndexOf('RED')
  return states.map((_, i) => i >= lastRed)
}
