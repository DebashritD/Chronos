import { describe, expect, it } from 'vitest'
import { ApiError, messageFor } from './errors'

describe('messageFor', () => {
  it('turns server validation details into sentences', () => {
    expect(messageFor(new ApiError(400, 'VALIDATION', 'name: must not be blank'))).toBe("Name can't be empty.")
    expect(
      messageFor(new ApiError(400, 'VALIDATION', 'password: size must be between 8 and 128; minText: size must be between 0 and 200')),
    ).toBe('Password must be 8–128 characters. Minimum must be at most 200 characters.')
    expect(messageFor(new ApiError(400, 'VALIDATION', 'timezone: unknown timezone'))).toBe(
      'Timezone: unknown timezone.',
    )
    expect(messageFor(new ApiError(400, 'VALIDATION', 'Malformed request body'))).toBe('Malformed request body')
  })

  it('explains network failures', () => {
    expect(messageFor(new TypeError('Failed to fetch'))).toBe("Couldn't reach Chronos. Check your connection and try again.")
  })

  it('maps known codes to friendly copy', () => {
    expect(messageFor(new ApiError(409, 'USERNAME_TAKEN', null))).toBe('That username is taken')
    expect(messageFor(new ApiError(422, 'CHECK_IN_NOT_ALLOWED', null))).toBe(
      'That period can no longer be changed',
    )
  })

  it('falls back for unknown errors', () => {
    expect(messageFor(new Error('boom'))).toBe('Something went wrong. Try again in a moment.')
    expect(messageFor(new ApiError(500, null, null))).toBe('Something went wrong. Try again in a moment.')
  })
})
