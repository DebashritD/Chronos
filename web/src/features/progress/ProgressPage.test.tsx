import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { MonthView, WeekView } from '../../api/types'
import { jsonResponse, stubApi } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { ProgressPage } from './ProgressPage'

const empty = { green: 0, yellow: 0, red: 0, grey: 0, total: 0 }
const week: WeekView = { start: '2026-11-16', today: '2026-11-18', distribution: empty, habits: [] }
const month: MonthView = { month: '2026-11', distribution: empty, overview: [], habits: [] }

function api() {
  return stubApi(({ url }) => {
    if (url.startsWith('/api/stats/week')) {
      const start = new URL(url, 'http://x').searchParams.get('start')
      return jsonResponse(start ? { ...week, start } : week)
    }
    if (url.startsWith('/api/stats/month')) return jsonResponse(month)
    if (url === '/api/stats/streaks') return jsonResponse([])
    return undefined
  })
}

describe('ProgressPage', () => {
  it('starts on the week and switches to the month', async () => {
    api()
    const { user } = renderWithProviders(<ProgressPage />, { route: '/progress' })

    const views = screen.getByRole('group', { name: 'View' })
    expect(within(views).getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByRole('heading', { name: '16 – 22 Nov 2026' })).toBeInTheDocument()

    await user.click(within(views).getByRole('button', { name: 'Month' }))

    expect(within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Month' })).toHaveFocus()
  })

  it('opens on the month from the URL and goes back to the week', async () => {
    api()
    const { user } = renderWithProviders(<ProgressPage />, { route: '/progress?view=month' })

    expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Week' }))

    expect(await screen.findByRole('heading', { name: '16 – 22 Nov 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Week' })).toHaveFocus()
  })

  it('does not steal focus on the initial load', async () => {
    api()
    renderWithProviders(<ProgressPage />, { route: '/progress' })

    expect(await screen.findByRole('heading', { name: '16 – 22 Nov 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Week' })).not.toHaveFocus()
  })

  it('focuses the toggle once per switch, not on later navigation', async () => {
    api()
    const { user } = renderWithProviders(<ProgressPage />, { route: '/progress?view=month' })

    expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Week' }))
    expect(await screen.findByRole('heading', { name: '16 – 22 Nov 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Week' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Next week' }))
    expect(await screen.findByRole('heading', { name: '23 – 29 Nov 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Week' })).not.toHaveFocus()
  })
})
