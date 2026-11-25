import type { CellState } from '../api/types'

/** Bright = everything after the row's last miss, and every miss. Other marks before the last miss are dim. */
export function brightness(states: readonly CellState[]): boolean[] {
  const lastRed = states.lastIndexOf('RED')
  return states.map((state, i) => state === 'RED' || i > lastRed)
}
