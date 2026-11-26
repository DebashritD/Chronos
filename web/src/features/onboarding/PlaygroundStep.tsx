import { useState } from 'react'
import { api } from '../../api/client'
import { messageFor } from '../../api/errors'
import type { Color, Me } from '../../api/types'
import { Mark } from '../../app/Mark'
import { Stepper } from '../../app/Stepper'
import { brightness } from '../../lib/brightness'
import { STATE_LABEL } from '../../lib/cells'
import { eyebrow } from '../../lib/ui'
import { useSession } from '../auth/session'
import { PLAYGROUND_DAYS, playgroundStreak } from './playground'
import { Hint, primaryButton, StepFooter, StepHeading } from './ui'

const START: Color[] = ['GREEN', 'YELLOW', 'GREEN', 'GREEN', 'YELLOW', 'YELLOW', 'GREEN']
const NEXT: Record<Color, Color> = { GREEN: 'YELLOW', YELLOW: 'RED', RED: 'GREEN' }
const FIRST_DATE = 16
const HINTS = [
  'Tap any of Read’s days to change its mark.',
  'Now try three Minimums in a row.',
  'One too many Minimums restarts the streak. Change the limit below and watch.',
]
const grid = 'grid grid-cols-[5.2rem_repeat(7,minmax(0,1fr))] items-center'

/** A sample week on Progress to play with, plus the real "Minimums allowed in a row" setting. */
export function PlaygroundStep({ onNext }: { onNext(): void }) {
  const { me, setMe } = useSession()
  const saved = me?.maxYellows ?? 2
  const [marks, setMarks] = useState(START)
  const [limit, setLimit] = useState(saved)
  const [tapped, setTapped] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const streak = playgroundStreak(marks, limit)
  const bright = brightness(marks)
  const hint = !tapped ? 0 : streak.restart === 'minimums' ? 2 : 1

  async function next(): Promise<void> {
    if (limit === saved) return onNext()
    setError(null)
    setBusy(true)
    try {
      setMe(await api.put<Me>('/api/auth/me', { maxYellows: limit }))
      onNext()
    } catch (err) {
      setError(messageFor(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <StepHeading label="Progress" small>Minimums keep streaks alive.</StepHeading>
      <p className="mt-2 text-[14px] text-muted">This is a week on the Progress tab.</p>
      <Hint>{HINTS[hint]}</Hint>
      <div className={`${grid} mt-1 pb-1.5 text-center`} aria-hidden="true">
        <span />
        {PLAYGROUND_DAYS.map((day, i) => (
          <span key={day} className="flex flex-col items-center">
            <i className="text-[10px] font-semibold tracking-[0.14em] text-muted not-italic">{day[0]}</i>
            <b className="font-display text-[15px] leading-tight font-normal">{FIRST_DATE + i}</b>
          </span>
        ))}
      </div>
      <div className={`${grid} border-y border-rule`}>
        <div>
          <p className="font-display text-[17px] leading-tight text-ink">Read</p>
          <p className="font-mono text-[11px] text-muted">daily</p>
        </div>
        {marks.map((mark, i) => {
          const dim = !bright[i]
          const joined = i > 0 && marks[i - 1] !== 'RED' && mark !== 'RED'
          return (
            <div key={PLAYGROUND_DAYS[i]} className="relative flex h-14 items-center">
              {joined && (
                <span aria-hidden="true" className={`absolute top-1/2 right-1/2 left-[-50%] h-[1.5px] -translate-y-1/2 ${
                  mark === 'GREEN' ? 'bg-cell-green' : 'bg-cell-yellow'} ${dim ? 'opacity-30' : 'opacity-60'}`} />
              )}
              <button type="button" aria-label={`Read, ${PLAYGROUND_DAYS[i]} ${FIRST_DATE + i}: ${STATE_LABEL[mark]}`}
                onClick={() => {
                  setMarks(marks.map((m, j) => (j === i ? NEXT[m] : m)))
                  setTapped(true)
                }}
                className="relative z-[1] flex h-11 w-full items-center justify-center rounded-full active:bg-paper-2">
                <Mark kind={mark} dim={dim && mark !== 'RED'} />
              </button>
            </div>
          )
        })}
      </div>
      <div className="mt-3.5 border-t border-rule-2 pt-2.5">
        <div className="flex items-baseline justify-between">
          <h2 className={eyebrow}>Streaks</h2>
          <span className="text-[11px] font-semibold tracking-[0.14em] text-muted">NOW · BEST</span>
        </div>
        <div className="flex items-baseline gap-3 border-b border-rule py-2">
          <span className="flex-1 font-display text-[19px] text-ink">Read</span>
          <span className={`font-display text-[22px] leading-none font-bold transition-opacity ${streak.now === 0 ? 'opacity-45' : ''}`}>
            <span className="sr-only">Current streak </span>{streak.now}
          </span>
          <span className="w-16 text-right font-mono text-[12px] text-muted">best {streak.best}</span>
        </div>
      </div>
      <p aria-live="polite" className="mt-3 rounded-[10px] bg-paper-2 px-3.5 py-2.5 text-[13px] leading-normal text-ink">{streak.reason}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <p id="intro-limit" className="font-display text-[15px] leading-tight text-ink">Minimums allowed in a row</p>
          <p className="mt-0.5 text-[12px] text-muted">Your real setting. Change it later in Me.</p>
        </div>
        <Stepper value={limit} min={1} max={7} labelledBy="intro-limit" onChange={setLimit} />
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-cell-red">{error}</p>}
      <StepFooter><button type="button" disabled={busy} className={primaryButton} onClick={() => void next()}>Next</button></StepFooter>
    </>
  )
}
