export interface Me {
  username: string
  timezone: string
}

export type Frequency = 'DAILY' | 'EVERY_N_DAYS' | 'WEEKLY'
export type HabitStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
export type Color = 'GREEN' | 'YELLOW' | 'RED'
export type CellState = Color | 'PAUSED' | 'PENDING' | 'GREY' | 'NOT_DUE'

export interface HabitTexts {
  name: string
  minText: string
  targetText: string
}

export interface NewHabit extends HabitTexts {
  frequency: Frequency
  intervalDays?: number
  startDate?: string
}

export interface Habit extends HabitTexts {
  id: number
  frequency: Frequency
  intervalDays?: number
  startDate: string
  status: HabitStatus
}

export interface Distribution {
  green: number
  yellow: number
  red: number
  grey: number
  total: number
}

export interface WeekCell {
  date: string
  periodStart: string | null
  state: CellState
  editable: boolean
  note: string | null
  /** UTC instant when the cell's period ends (start of the next day in the user's timezone); null when NOT_DUE. */
  closesAt: string | null
}

/** The period containing the user's today, independent of the requested week. */
export interface CurrentPeriod {
  periodStart: string
  state: CellState
  editable: boolean
  note: string | null
  closesAt: string
}

export interface WeekHabit extends HabitTexts {
  id: number
  frequency: Frequency
  intervalDays: number | null
  /** null when today is before the habit's first period */
  current: CurrentPeriod | null
  cells: WeekCell[]
}

export interface WeekView {
  start: string
  today: string
  habits: WeekHabit[]
  distribution: Distribution
}

export interface MonthHabit {
  id: number
  name: string
  frequency: Frequency
  cells: { date: string; state: CellState }[]
}

export interface MonthView {
  month: string
  overview: { date: string; score: number | null }[]
  habits: MonthHabit[]
  distribution: Distribution
}

export interface Streak {
  habitId: number
  name: string
  current: number
  best: number
}
