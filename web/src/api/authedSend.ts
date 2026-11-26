import { waitForAuth } from '../features/checkin/authGate'
import { ApiError } from './errors'
import { notifyQueryError } from './queryErrorBridge'

/** Runs a queued write; on a 401 it signs out like a query would, then waits for the same user and tries again. */
export async function authedSend<T>(fn: () => Promise<T>): Promise<T> {
  for (;;) {
    try {
      return await fn()
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error
      notifyQueryError(error)
      await waitForAuth()
    }
  }
}
