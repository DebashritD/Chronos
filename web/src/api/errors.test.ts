import { describe, expect, it } from 'vitest'
import { ApiError, messageFor } from './errors'

describe('messageFor', () => {
  it('uses the server detail for validation errors', () => {
    expect(messageFor(new ApiError(400, 'VALIDATION', 'name: must not be blank'))).toBe('name: must not be blank')
  })

  it('maps known codes to friendly copy', () => {
    expect(messageFor(new ApiError(409, 'USERNAME_TAKEN', null))).toBe('That username is taken')
    expect(messageFor(new ApiError(422, 'CHECK_IN_NOT_ALLOWED', null))).toBe(
      'That period can no longer be changed',
    )
  })

  it('falls back for unknown errors', () => {
    expect(messageFor(new Error('boom'))).toBe('Something went wrong')
    expect(messageFor(new ApiError(500, null, null))).toBe('Something went wrong')
  })
})
