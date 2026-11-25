/** Date helpers on ISO strings ("YYYY-MM-DD" / "YYYY-MM"). All math is in UTC so the browser timezone never matters. */

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

function parse(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  const date = parse(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return format(date)
}

export function addMonths(yearMonth: string, months: number): string {
  const date = parse(`${yearMonth}-01`)
  date.setUTCMonth(date.getUTCMonth() + months)
  return format(date).slice(0, 7)
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(iso: string): number {
  return (parse(iso).getUTCDay() + 6) % 7
}

export function dayOfMonth(iso: string): number {
  return parse(iso).getUTCDate()
}

const dayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
const longWeekdayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long' })
const dayMonthFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })
const monthFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })

/** "Wed 18 Nov" */
export function formatDay(iso: string): string {
  return dayFormat.format(parse(iso)).replace(',', '')
}

/** "Wednesday" */
export function formatWeekday(iso: string): string {
  return longWeekdayFormat.format(parse(iso))
}

/** "Wednesday, 18 Nov" (the Today eyebrow) */
export function formatLongDay(iso: string): string {
  return `${longWeekdayFormat.format(parse(iso))}, ${dayMonthFormat.format(parse(iso))}`
}

/** "16 – 22 Nov 2026", or "30 Nov – 6 Dec 2026" across months. */
export function formatWeekRange(start: string): string {
  const end = addDays(start, 6)
  const year = end.slice(0, 4)
  const endText = dayMonthFormat.format(parse(end))
  const startText = start.slice(5, 7) === end.slice(5, 7) ? String(dayOfMonth(start)) : dayMonthFormat.format(parse(start))
  return `${startText} – ${endText} ${year}`
}

/** "November 2026" */
export function formatMonth(yearMonth: string): string {
  return monthFormat.format(parse(`${yearMonth}-01`))
}
