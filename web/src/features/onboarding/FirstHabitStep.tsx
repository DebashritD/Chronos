import { useState, type FormEvent } from 'react'
import { api } from '../../api/client'
import { messageFor } from '../../api/errors'
import { underlineInput } from '../../lib/ui'
import { useSession } from '../auth/session'
import { useCreateHabit, useHabits } from '../habits/api'
import { STARTERS } from './starters'
import { fieldLabel, lede, primaryButton, StepFooter, StepHeading } from './ui'

interface FirstHabitStepProps {
  /** A replay from Me: never marks the account onboarded. */
  replay: boolean
  /** Called with the new habit's name, or null when the user already had habits. */
  onDone(habitName: string | null): void
}

const chip = (on: boolean) =>
  `min-h-10 rounded-full border-[1.5px] px-3.5 text-[14px] font-semibold ${on ? 'border-ink bg-ink text-paper' : 'border-rule-2 text-ink'}`

/** The one screen without Skip: everyone leaves the intro with a habit. */
export function FirstHabitStep({ replay, onDone }: FirstHabitStepProps) {
  const { me, setMe } = useSession()
  const habits = useHabits()
  const createHabit = useCreateHabit()
  const [name, setName] = useState('')
  const [minText, setMinText] = useState('')
  const [targetText, setTargetText] = useState('')
  const [starter, setStarter] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  /** `strict` surfaces a failure; after a habit is created the flow carries on and the next app load retries. */
  async function finishIntro(strict: boolean): Promise<void> {
    if (replay) return
    try {
      await api.post('/api/auth/me/onboarded')
    } catch (err) {
      if (strict) throw err
    }
    if (me) setMe({ ...me, onboarded: true })
  }

  async function run(action: () => Promise<void>): Promise<void> {
    setError(null)
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setError(messageFor(err))
    } finally {
      setBusy(false)
    }
  }

  function edit(set: (value: string) => void, value: string): void {
    set(value)
    setStarter(null)
  }

  function pick(i: number): void {
    const s = STARTERS[i]
    setName(s.name)
    setMinText(s.minText)
    setTargetText(s.targetText)
    setStarter(i)
  }

  async function create(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    await run(async () => {
      const habit = await createHabit.mutateAsync({
        name: name.trim(), minText: minText.trim(), targetText: targetText.trim(), frequency: 'DAILY', yellowCap: true,
      })
      await finishIntro(false)
      onDone(habit.name)
    })
  }

  const errorLine = error && <p role="alert" className="mt-3 text-sm text-cell-red">{error}</p>

  if (habits.data && habits.data.length > 0) {
    return (
      <>
        <StepHeading label="Your habits">You already have habits.</StepHeading>
        <p className={lede}>They’re waiting on Today. Add more any time from Me.</p>
        {errorLine}
        <StepFooter>
          <button type="button" disabled={busy} className={primaryButton}
            onClick={() => void run(async () => {
              await finishIntro(true)
              onDone(null)
            })}>Done</button>
        </StepFooter>
      </>
    )
  }

  const filled = [name, minText, targetText].every((v) => v.trim())
  return (
    <form onSubmit={(event) => void create(event)} className="flex flex-1 flex-col">
      <StepHeading label="Your first habit">Start with one habit.</StepHeading>
      <p className="mt-3 text-[14px] text-muted">Pick one of these, or write your own.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {STARTERS.map((s, i) => (
          <button key={s.name} type="button" aria-pressed={starter === i} className={chip(starter === i)} onClick={() => pick(i)}>
            {s.name}
          </button>
        ))}
      </div>
      <p className="mt-5 flex items-center gap-3 text-[12.5px] font-semibold text-muted before:flex-1 before:border-t before:border-rule-2 after:flex-1 after:border-t after:border-rule-2">
        Or create your own
      </p>
      <div className="mt-3 flex flex-col gap-1">
        <label htmlFor="intro-name" className={fieldLabel}>Name</label>
        <input id="intro-name" maxLength={80} placeholder="e.g. Journal" value={name}
          onChange={(e) => edit(setName, e.target.value)} className={underlineInput} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-1">
          <label htmlFor="intro-min" className={fieldLabel}>Minimum</label>
          <input id="intro-min" maxLength={200} placeholder="e.g. 1 line" value={minText}
            onChange={(e) => edit(setMinText, e.target.value)} className={underlineInput} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="intro-target" className={fieldLabel}>Target</label>
          <input id="intro-target" maxLength={200} placeholder="e.g. 1 page" value={targetText}
            onChange={(e) => edit(setTargetText, e.target.value)} className={underlineInput} />
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-1">
        <p className={fieldLabel}>How often</p>
        <p className="border-b border-rule-2 py-2.5 text-[16px] text-ink">Every day</p>
      </div>
      <p className="mt-2.5 text-[13px] leading-normal text-muted">Tip: make the minimum small enough for your worst day.</p>
      {errorLine}
      <StepFooter note="add more from Me any time">
        <button type="submit" disabled={!filled || busy} className={primaryButton}>Create habit</button>
      </StepFooter>
    </form>
  )
}
