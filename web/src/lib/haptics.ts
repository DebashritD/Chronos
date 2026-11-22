import type { Color } from '../api/types'

const PATTERNS: Record<Color, number | number[]> = {
  GREEN: [12, 50, 24],
  YELLOW: 14,
  RED: 8,
}

/** A short vibration for a mark; a no-op where the Vibration API is missing (e.g. iOS). */
export function hapticMark(color: Color): void {
  try {
    navigator.vibrate?.(PATTERNS[color])
  } catch {
    // Some browsers throw outside a user gesture; feedback is best-effort.
  }
}
