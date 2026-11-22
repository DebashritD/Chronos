/** Error thrown by the API client for non-2xx responses; `code`/`detail` come from the problem JSON body. */
export class ApiError extends Error {
  status: number
  code: string | null
  detail: string | null

  constructor(status: number, code: string | null, detail: string | null) {
    super(detail ?? `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.detail = detail
  }
}

const MESSAGES_BY_CODE: Record<string, string> = {
  BAD_CREDENTIALS: 'Wrong username or password',
  TOO_MANY_ATTEMPTS: 'Too many attempts, try again later',
  USERNAME_TAKEN: 'That username is taken',
  INVALID_STATE: "That action isn't available for this habit right now",
  CHECK_IN_NOT_ALLOWED: 'That period can no longer be changed',
  NOT_FOUND: 'Not found',
}

const FALLBACK_MESSAGE = 'Something went wrong'

/** Maps an error (typically an `ApiError`) to user-facing copy. */
export function messageFor(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return FALLBACK_MESSAGE
  }
  if (error.code === 'VALIDATION') {
    return error.detail ?? FALLBACK_MESSAGE
  }
  if (error.code && error.code in MESSAGES_BY_CODE) {
    return MESSAGES_BY_CODE[error.code]
  }
  return FALLBACK_MESSAGE
}
