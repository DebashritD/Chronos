import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { jsonResponse, problemResponse, requests, stubApi } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  it('logs in and goes to Today', async () => {
    const fetchMock = stubApi(({ url }) =>
      url === '/api/auth/login' ? jsonResponse({ username: 'bob', timezone: 'Asia/Kolkata' }) : undefined,
    )
    const { user } = renderWithProviders(<LoginPage />, { route: '/login', me: null })

    await user.type(screen.getByLabelText('Username'), 'bob')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByTestId('location-display')).toHaveTextContent('/')
    expect(requests(fetchMock)).toEqual([
      { method: 'POST', url: '/api/auth/login', body: { username: 'bob', password: 'password123' } },
    ])
  })

  it('shows the error for wrong credentials', async () => {
    stubApi(() => problemResponse(401, 'BAD_CREDENTIALS'))
    const { user } = renderWithProviders(<LoginPage />, { route: '/login', me: null })

    await user.type(screen.getByLabelText('Username'), 'bob')
    await user.type(screen.getByLabelText('Password'), 'nope-nope')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong username or password')
  })

  it('links to sign-up', () => {
    stubApi(() => undefined)
    renderWithProviders(<LoginPage />, { route: '/login', me: null })

    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/signup')
  })
})
