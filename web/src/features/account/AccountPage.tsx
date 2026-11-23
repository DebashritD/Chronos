import { useIsMutating, useQueryClient } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { api } from '../../api/client'
import { messageFor } from '../../api/errors'
import type { Me } from '../../api/types'
import { useOnline } from '../../lib/useOnline'
import { card, cardTitle, inputClass, pageTitle, primaryButton, secondaryButton } from '../../lib/ui'
import { browserTimezone, useSession } from '../auth/session'
import { CHECK_IN_KEY } from '../checkin/queue'

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
  return count === 1 ? '1 mark hasn’t synced. Log out anyway?' : `${count} marks haven’t synced. Log out anyway?`
}

export function AccountPage() {
  const { me, setMe, logout } = useSession()
  const unsynced = useIsMutating({ mutationKey: CHECK_IN_KEY })
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  // Logging out offline would leave the server session open and drop the saved data the app needs to sign back in.
  const online = useOnline()
  const queryClient = useQueryClient()
  const [timezone, setTimezone] = useState(me?.timezone ?? '')
  const [tzFeedback, setTzFeedback] = useState<Feedback>(null)
  const [maxYellows, setMaxYellows] = useState(String(me?.maxYellows ?? 2))
  const [ruleFeedback, setRuleFeedback] = useState<Feedback>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwFeedback, setPwFeedback] = useState<Feedback>(null)

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
      setMe(await api.put<Me>('/api/auth/me', { maxYellows: Number(maxYellows) }))
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

  const label = 'mb-1.5 block text-[13px] font-medium text-muted'
  return (
    <section className="max-w-lg">
      <h1 className={`${pageTitle} mb-5`}>Account</h1>
      <div className={`${card} mb-4 flex items-center gap-4`}>
        <span aria-hidden="true"
          className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-accent text-lg font-bold text-bg">
          {me?.username.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold text-fg">{me?.username}</p>
          <p className="truncate text-[13px] text-muted">{me?.timezone}</p>
        </div>
      </div>
      <form className={`${card} mb-4`} onSubmit={(event) => void saveTimezone(event)}>
        <h2 className={cardTitle}>Timezone</h2>
        <label htmlFor="timezone" className="sr-only">Timezone</label>
        <input id="timezone" list="timezones" required value={timezone}
          onChange={(e) => setTimezone(e.target.value)} className={inputClass} />
        <datalist id="timezones">
          {timezones().map((zone) => <option key={zone} value={zone} />)}
        </datalist>
        <p className="mt-2 text-xs text-dim">Days (and countdowns) end at midnight in this timezone.</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setTimezone(browserTimezone())} className={secondaryButton}>
            Use this device
          </button>
          <button type="submit" className={primaryButton}>Save timezone</button>
        </div>
        <FeedbackLine feedback={tzFeedback} />
      </form>
      <form className={`${card} mb-4`} onSubmit={(event) => void saveStreakRule(event)}>
        <h2 className={cardTitle}>Streak rules</h2>
        <label htmlFor="max-yellows" className={label}>Yellows allowed in a row</label>
        <input id="max-yellows" type="number" min={1} max={7} required value={maxYellows}
          onChange={(e) => setMaxYellows(e.target.value)} className={inputClass} />
        <p className="mt-2 text-xs text-dim">For habits with the limit on, one more yellow starts the streak over.</p>
        <button type="submit" className={`${primaryButton} mt-4`}>Save streak rule</button>
        <FeedbackLine feedback={ruleFeedback} />
      </form>
      <form className={`${card} mb-4`} onSubmit={(event) => void changePassword(event)}>
        <h2 className={cardTitle}>Change password</h2>
        <div className="mb-3">
          <label htmlFor="current-password" className={label}>Current password</label>
          <input id="current-password" type="password" autoComplete="current-password" required
            value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} />
        </div>
        <div className="mb-4">
          <label htmlFor="new-password" className={label}>New password</label>
          <input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={72}
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
        </div>
        <button type="submit" className={primaryButton}>Change password</button>
        <FeedbackLine feedback={pwFeedback} />
      </form>
      <button type="button" disabled={!online} onClick={() => (unsynced > 0 ? setConfirmingLogout(true) : void logout())}
        className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-line bg-card px-4 py-3 text-[15px] font-semibold text-cell-red disabled:opacity-50">
        <LogOut size={18} aria-hidden="true" />
        Log out
      </button>
      {!online && <p className="mt-2 text-center text-[13px] text-dim">Connect to log out.</p>}
      {confirmingLogout && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setConfirmingLogout(false)
          }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="logout-unsynced"
            className="w-full max-w-sm rounded-[28px] border border-line bg-card p-6 text-center">
            <p id="logout-unsynced" className="text-[17px] font-semibold text-fg">{unsyncedMarksCopy(Math.max(unsynced, 1))}</p>
            <div className="mt-5 flex gap-3">
              <button type="button" autoFocus onClick={() => setConfirmingLogout(false)} className={`${secondaryButton} flex-1`}>
                Cancel
              </button>
              <button type="button" disabled={!online} onClick={() => {
                setConfirmingLogout(false)
                void logout()
              }} className={`${primaryButton} flex-1`}>
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
