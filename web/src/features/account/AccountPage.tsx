import { useIsMutating, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Stepper } from '../../app/Stepper'
import { api } from '../../api/client'
import { messageFor } from '../../api/errors'
import type { Me } from '../../api/types'
import { useOnline } from '../../lib/useOnline'
import { eyebrow, inkButton, outlineButton, section, underlineInput } from '../../lib/ui'
import { browserTimezone, useSession } from '../auth/session'
import { useHabits } from '../habits/api'
import { NewHabitSheet } from '../habits/NewHabitSheet'
import { isQueuedChange } from '../tasks/queue'

type Feedback = { kind: 'ok' | 'error'; text: string } | null

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null
  return feedback.kind === 'ok'
    ? <p role="status" className="mt-3 text-sm text-cell-green">{feedback.text}</p>
    : <p role="alert" className="mt-3 text-sm text-cell-red">{feedback.text}</p>
}

/** Every timezone the browser knows, for the datalist (empty on very old browsers). */
function timezones(): string[] {
  return typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
}

export function unsyncedMarksCopy(count: number): string {
  return count === 1 ? '1 change hasn’t synced. Log out anyway?' : `${count} changes haven’t synced. Log out anyway?`
}

export function AccountPage() {
  const { me, setMe, logout } = useSession()
  const unsynced = useIsMutating({ predicate: isQueuedChange })
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  // Logging out offline would leave the server session open and drop the saved data the app needs to sign back in.
  const online = useOnline()
  const queryClient = useQueryClient()
  const [timezone, setTimezone] = useState(me?.timezone ?? '')
  const [tzFeedback, setTzFeedback] = useState<Feedback>(null)
  const [maxYellows, setMaxYellows] = useState(me?.maxYellows ?? 2)
  const [ruleFeedback, setRuleFeedback] = useState<Feedback>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwFeedback, setPwFeedback] = useState<Feedback>(null)
  const current = useHabits()
  const archived = useHabits('ARCHIVED')
  const [creating, setCreating] = useState(false)

  async function saveTimezone(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setTzFeedback(null)
    try {
      setMe(await api.put<Me>('/api/auth/me', { timezone }))
      // "Today" and every countdown may have moved, so every stats view is stale.
      await queryClient.invalidateQueries({ queryKey: ['stats'] })
      setTzFeedback({ kind: 'ok', text: 'Timezone saved' })
    } catch (err) {
      setTzFeedback({ kind: 'error', text: messageFor(err) })
    }
  }

  async function saveStreakRule(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setRuleFeedback(null)
    try {
      setMe(await api.put<Me>('/api/auth/me', { maxYellows: maxYellows }))
      await queryClient.invalidateQueries({ queryKey: ['stats'] })
      setRuleFeedback({ kind: 'ok', text: 'Streak rule saved' })
    } catch (err) {
      setRuleFeedback({ kind: 'error', text: messageFor(err) })
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setPwFeedback(null)
    try {
      setMe(await api.put<Me>('/api/auth/me', { currentPassword, newPassword }))
      setCurrentPassword('')
      setNewPassword('')
      setPwFeedback({ kind: 'ok', text: 'Password changed' })
    } catch (err) {
      setPwFeedback({ kind: 'error', text: messageFor(err) })
    }
  }

  const label = 'block text-[13px] font-medium text-muted'
  return (
    <section className="max-w-lg">
      <h1 className={eyebrow}>Account</h1>
      <div className="mt-4 flex items-center gap-4">
        <span aria-hidden="true" className="flex h-16 w-16 flex-none -rotate-6 items-center justify-center rounded-full border-2 border-accent font-display text-[34px] text-accent shadow-[inset_0_0_0_3px_var(--color-paper),inset_0_0_0_4.5px_var(--color-accent)]">
          {me?.username.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-[29px] leading-none text-ink">{me?.username}</p>
          <p className="mt-1.5 truncate font-mono text-[12px] text-muted">{me?.timezone} · day ends 00:00</p>
        </div>
      </div>
      <section className={section} aria-labelledby="habits-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="habits-heading" className={eyebrow}>Habits</h2>
          {current.data && (
            <span className="font-mono text-[12px] text-muted">
              {current.data.length} active{archived.data?.length ? ` · ${archived.data.length} archived` : ''}
            </span>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setCreating(true)} className={`${inkButton} flex-1`}><Plus size={18} strokeWidth={2.5} aria-hidden="true" />New habit</button>
          <Link to="/habits" className={`${outlineButton} flex-1`}>Manage habits</Link>
        </div>
      </section>
      {creating && <NewHabitSheet onClose={() => setCreating(false)} />}
      <form className={section} onSubmit={(event) => void saveStreakRule(event)}>
        <h2 className={eyebrow}>Streak rule</h2>
        <p id="max-yellows-label" className="mt-3 font-display text-[19px] text-ink">Minimums allowed in a row</p>
        <div className="mt-3"><Stepper value={maxYellows} min={1} max={7} labelledBy="max-yellows-label" onChange={setMaxYellows} /></div>
        <p className="mt-2 text-[12px] text-muted">For habits with the limit on, one more minimum starts the streak over.</p>
        <button type="submit" className={`${inkButton} mt-4`}>Save streak rule</button>
        <FeedbackLine feedback={ruleFeedback} />
      </form>
      <form className={section} onSubmit={(event) => void saveTimezone(event)}>
        <h2 className={eyebrow}>Timezone</h2>
        <label htmlFor="timezone" className="sr-only">Timezone</label>
        <input id="timezone" list="timezones" required value={timezone}
          onChange={(e) => setTimezone(e.target.value)} className={`${underlineInput} mt-3`} />
        <datalist id="timezones">
          {timezones().map((zone) => <option key={zone} value={zone} />)}
        </datalist>
        <p className="mt-2 text-[12px] text-muted">Days (and countdowns) end at midnight in this timezone.</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setTimezone(browserTimezone())} className={`${outlineButton} flex-1`}>
            Use this device
          </button>
          <button type="submit" className={`${inkButton} flex-1`}>Save timezone</button>
        </div>
        <FeedbackLine feedback={tzFeedback} />
      </form>
      <form className={section} onSubmit={(event) => void changePassword(event)}>
        <h2 className={eyebrow}>Change password</h2>
        <div className="mt-3">
          <label htmlFor="current-password" className={label}>Current password</label>
          <input id="current-password" type="password" autoComplete="current-password" required
            value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={underlineInput} />
        </div>
        <div className="mb-4 mt-3">
          <label htmlFor="new-password" className={label}>New password</label>
          <input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={72}
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={underlineInput} />
        </div>
        <button type="submit" className={inkButton}>Change password</button>
        <FeedbackLine feedback={pwFeedback} />
      </form>
      <div className="mt-8 border-t border-dashed border-rule-2 pt-5">
        <button type="button" disabled={!online} onClick={() => (unsynced > 0 ? setConfirmingLogout(true) : void logout())}
          className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-accent disabled:opacity-50">
          <span aria-hidden="true">↩</span>Log out
        </button>
        {!online && <p className="mt-1 text-[13px] text-muted">Connect to log out.</p>}
      </div>
      {confirmingLogout && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-binding/45 px-6"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setConfirmingLogout(false)
          }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="logout-unsynced"
            className="w-full max-w-sm rounded-[12px] border border-rule-2 bg-paper p-6 text-center shadow-[0_20px_50px_rgb(29_27_24/0.25)]">
            <p id="logout-unsynced" className="font-display text-[19px] text-ink">{unsyncedMarksCopy(Math.max(unsynced, 1))}</p>
            <div className="mt-5 flex gap-3">
              <button type="button" autoFocus onClick={() => setConfirmingLogout(false)} className={`${outlineButton} flex-1`}>
                Cancel
              </button>
              <button type="button" disabled={!online} onClick={() => {
                setConfirmingLogout(false)
                void logout()
              }} className={`${inkButton} flex-1`}>
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default AccountPage
