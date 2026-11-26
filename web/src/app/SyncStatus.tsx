import { useMutationState } from '@tanstack/react-query'
import { isQueuedChange } from '../features/tasks/queue'
import { useOnline } from '../lib/useOnline'

export function syncStatusText(online: boolean, pending: number): string | null {
  if (online) return pending > 0 ? `Syncing ${pending}…` : null
  return pending > 0 ? `Offline · ${pending} waiting to sync` : 'Offline'
}

/** Dim line under the page date; hidden when online with nothing queued. `className` sets its spacing. */
export function SyncStatus({ className = '-mt-4 mb-4' }: { className?: string }) {
  const online = useOnline()
  const pending = useMutationState({ filters: { predicate: isQueuedChange, status: 'pending' } }).length
  const text = syncStatusText(online, pending)
  if (text === null) return null
  return <p className={`${className} font-mono text-[12px] text-muted`}>{text}</p>
}

export default SyncStatus
