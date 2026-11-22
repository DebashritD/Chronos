import { QueryCache, QueryClient, type QueryObserverOptions } from '@tanstack/react-query'
import { ApiError } from './errors'
import { notifyQueryError } from './queryErrorBridge'

/**
 * Builds the app's QueryClient, wired so every query error is reported to
 * the query-error bridge (the SessionProvider uses this to drop to visitor
 * mode on a 401). `queryDefaults` lets callers (tests) override defaults
 * such as `retry` without losing the shared QueryCache wiring.
 */
export function createQueryClient(
  queryDefaults?: Partial<QueryObserverOptions>,
): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => notifyQueryError(error),
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Don't retry 4xx ApiErrors (e.g. 401/404) - they won't succeed on
        // retry and a 401 should reach the bridge immediately.
        retry: (failureCount, error) =>
          failureCount < 1 && !(error instanceof ApiError && error.status < 500),
        ...queryDefaults,
      },
    },
  })
}
