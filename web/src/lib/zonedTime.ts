/** Calendar dates and midnights in an IANA timezone, using Intl only (no timezone library). */
const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    formatters.set(timeZone, f)
  }
  return f
}

/** The wall-clock date in `timeZone` at instant `at`, and that wall-clock time read as if it were UTC. */
function wallClock(timeZone: string, at: number): { date: string; asUtc: number } {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(new Date(at)).map((p) => [p.type, p.value]))
  const date = `${parts.year}-${parts.month}-${parts.day}`
  return { date, asUtc: Date.parse(`${date}T${parts.hour}:${parts.minute}:${parts.second}Z`) }
}

/** "YYYY-MM-DD" in `timeZone` at `now`. */
export function todayIn(timeZone: string, now: Date): string {
  return wallClock(timeZone, now.getTime()).date
}

/** Midnight at the start of `date` in `timeZone`, as the server formats instants ("2026-11-18T18:30:00Z"). */
export function startOfDayIn(date: string, timeZone: string): string {
  const midnightAsUtc = Date.parse(`${date}T00:00:00Z`)
  const offset = (at: number) => wallClock(timeZone, at).asUtc - Math.floor(at / 1000) * 1000
  // Second pass corrects for an offset change (DST) between the guess and the answer.
  const guess = midnightAsUtc - offset(midnightAsUtc)
  return new Date(midnightAsUtc - offset(guess)).toISOString().replace('.000Z', 'Z')
}
