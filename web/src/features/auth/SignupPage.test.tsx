import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { jsonResponse, problemResponse, requests, stubApi } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { browserTimezone } from './session'
import { SignupPage } from './SignupPage'

describe('SignupPage', () => {
  it('creates the account with the browser timezone', async () => {
    const fetchMock = stubApi(({ url }) =>
      url === '/api/auth/signup' ? jsonResponse({ username: 'carol', timezone: browserTimezone() }, 201) : undefined,
    )
    const { user } = renderWithProviders(<SignupPage />, { route: '/signup', me: null })

    expect(screen.getByText(browserTimezone(), { exact: false })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Username'), 'carol')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(await screen.findByTestId('location-display')).toHaveTextContent('/')
    expect(requests(fetchMock)[0]).toEqual({
      method: 'POST',
      url: '/api/auth/signup',
      body: { username: 'carol', password: 'password123', timezone: browserTimezone() },
    })
  })

  it('explains a taken username', async () => {
    stubApi(() => problemResponse(409, 'USERNAME_TAKEN'))
    const { user } = renderWithProviders(<SignupPage />, { route: '/signup', me: null })

    await user.type(screen.getByLabelText('Username'), 'bob')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That username is taken')
  })
})
