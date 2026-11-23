import { createContext, useContext } from 'react'
import type { Streak } from '../api/types'

export interface YellowLimitHit {
  /** `limit`: this yellow used the last one allowed. `reset`: one past the limit restarted the streak. */
  kind: 'limit' | 'reset'
  name: string
  limit: number
}

export const YellowLimitContext = createContext<(hit: YellowLimitHit) => void>(() => {})

export function useNotifyYellowLimit(): (hit: YellowLimitHit) => void {
  return useContext(YellowLimitContext)
}

/** True while the habit has used every yellow it may have in a row; the next one restarts its streak. */
export function atYellowLimit(streak: Streak | undefined): streak is Streak & { yellowLimit: number } {
  return streak !== undefined && streak.yellowLimit !== null && streak.yellowRun >= streak.yellowLimit
}
