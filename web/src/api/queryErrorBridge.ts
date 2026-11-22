/**
 * Bridges query errors (reported via the shared QueryClient's QueryCache
 * `onError`, see `queryClient.ts`) to whoever wants to react to them -
 * currently the SessionProvider, which drops to visitor mode on a 401.
 */
type QueryErrorHandler = (error: unknown) => void

let handler: QueryErrorHandler | null = null

/** Registers the single active handler (or clears it with `null`). */
export function setQueryErrorHandler(next: QueryErrorHandler | null): void {
  handler = next
}

/** Reports a query error to the registered handler, if any. */
export function notifyQueryError(error: unknown): void {
  handler?.(error)
}
