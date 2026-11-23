import { useMutationState } from '@tanstack/react-query'
import { CHECK_IN_KEY } from '../features/checkin/queue'
import { useOnline } from '../lib/useOnline'

export function syncStatusText(online: boolean, pending: number): string | null {
  if (online) return pending > 0 ? `Syncing ${pending}…` : null
  return pending > 0 ? `Offline · ${pending} waiting to sync` : 'Offline'
}

/** Dim line under the page date; hidden when online with nothing queued. */
export function SyncStatus() {
  const online = useOnline()
  const pending = useMutationState({ filters: { mutationKey: CHECK_IN_KEY, status: 'pending' } }).length
  const text = syncStatusText(online, pending)
  if (text === null) return null
  return <p className="-mt-4 mb-4 text-[13px] text-dim">{text}</p>
}

export default SyncStatus
