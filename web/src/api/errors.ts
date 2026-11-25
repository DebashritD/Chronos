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
  NOT_FOUND: "That item doesn't exist anymore",
}

const FALLBACK_MESSAGE = 'Something went wrong. Try again in a moment.'
const OFFLINE_MESSAGE = "Couldn't reach No Reds. Check your connection and try again."

const FIELD_LABELS: Record<string, string> = {
  username: 'Username',
  password: 'Password',
  currentPassword: 'Current password',
  newPassword: 'New password',
  timezone: 'Timezone',
  name: 'Name',
  minText: 'Minimum',
  targetText: 'Target',
  intervalDays: 'Interval',
  startDate: 'Start date',
  note: 'Note',
}

function humanizeRule(rule: string): string {
  if (rule === 'must not be blank' || rule === 'must not be null') return "can't be empty"
  const size = /^size must be between (\d+) and (\d+)$/.exec(rule)
  if (size) return size[1] === '0' ? `must be at most ${size[2]} characters` : `must be ${size[1]}–${size[2]} characters`
  return rule
}

/** Turns "field: rule; field: rule" server details into sentences like "Password must be 8–128 characters." */
function humanizeValidation(detail: string): string {
  return detail
    .split('; ')
    .map((part) => {
      const [field, ...rest] = part.split(': ')
      const label = FIELD_LABELS[field]
      if (!label || rest.length === 0) return part
      const rule = humanizeRule(rest.join(': '))
      return /^(must|can't|is) /.test(rule) ? `${label} ${rule}.` : `${label}: ${rule}.`
    })
    .join(' ')
}

/** Maps an error (typically an `ApiError`) to user-facing copy. */
export function messageFor(error: unknown): string {
  if (error instanceof TypeError) {
    return OFFLINE_MESSAGE
  }
  if (!(error instanceof ApiError)) {
    return FALLBACK_MESSAGE
  }
  if (error.code === 'VALIDATION') {
    return error.detail ? humanizeValidation(error.detail) : FALLBACK_MESSAGE
  }
  if (error.code && error.code in MESSAGES_BY_CODE) {
    return MESSAGES_BY_CODE[error.code]
  }
  return FALLBACK_MESSAGE
}
