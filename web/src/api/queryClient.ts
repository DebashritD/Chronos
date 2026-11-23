import { QueryCache, QueryClient, type QueryObserverOptions } from '@tanstack/react-query'
import { registerCheckInDefaults } from '../features/checkin/queue'
import { ApiError } from './errors'
import { PERSIST_MAX_AGE } from './persist'
import { notifyQueryError } from './queryErrorBridge'

/**
 * Builds the app's QueryClient, wired so every query error is reported to
 * the query-error bridge (the SessionProvider uses this to drop to visitor
 * mode on a 401), with the check-in queue's mutation defaults registered.
 * `queryDefaults` lets callers (tests) override defaults such as `retry`
 * without losing the shared wiring.
 */
export function createQueryClient(
  queryDefaults?: Partial<QueryObserverOptions>,
): QueryClient {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => notifyQueryError(error),
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Persisted data must outlive unmounted pages, or it is dropped before it is saved.
        gcTime: PERSIST_MAX_AGE,
        // Don't retry 4xx ApiErrors (e.g. 401/404) - they won't succeed on
        // retry and a 401 should reach the bridge immediately.
        retry: (failureCount, error) =>
          failureCount < 1 && !(error instanceof ApiError && error.status < 500),
        ...queryDefaults,
      },
    },
  })
  registerCheckInDefaults(queryClient)
  return queryClient
}
