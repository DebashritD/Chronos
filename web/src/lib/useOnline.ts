import { onlineManager } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

/** TanStack's view of the connection (the same signal that pauses queries and queued marks). */
export function useOnline(): boolean {
  return useSyncExternalStore((onChange) => onlineManager.subscribe(onChange), () => onlineManager.isOnline())
}
