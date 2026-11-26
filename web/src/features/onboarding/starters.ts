import type { HabitTexts } from '../../api/types'

/** One-tap first habits; the minimums are small enough for a bad day. */
export const STARTERS: HabitTexts[] = [
  { name: 'Read', minText: '5 pages', targetText: '20 pages' },
  { name: 'Walk', minText: '10 min', targetText: '30 min' },
  { name: 'Workout', minText: '10 min', targetText: '45 min' },
  { name: 'Meditate', minText: '2 min', targetText: '10 min' },
  { name: 'Stretch', minText: '1 stretch', targetText: '15 min' },
]
