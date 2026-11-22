import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CellState, MonthView } from '../../api/types'
import { jsonResponse, requests, stubApi } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { MonthPanel } from './MonthPanel'

const dates = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`)
const scores: (number | null)[] = [2, 0.3, 1, 1.25, 0.5]

const month: MonthView = {
  month: '2026-11',
  distribution: { green: 2, yellow: 1, red: 1, grey: 0, total: 4 },
  overview: dates.map((date, i) => ({ date, score: scores[i] ?? null })),
  habits: [
    { id: 1, name: 'Read', frequency: 'DAILY',
      cells: dates.map((date, i) => ({ date, state: ((['GREEN', 'RED'] as CellState[])[i] ?? 'PENDING') })) },
  ],
}

function api() {
  return stubApi(({ url }) => (url.startsWith('/api/stats/month') ? jsonResponse(month) : undefined))
}

describe('MonthPanel', () => {
  it('colors the overview on a red → green scale, Monday first', async () => {
    api()
    renderWithProviders(<MonthPanel />, { route: '/progress?view=month' })

    expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument()
    const overview = screen.getByRole('region', { name: 'Daily score' })
    expect(within(overview).getByRole('img', { name: 'Sun 1 Nov: score 2.0' })).toHaveClass('bg-score-4')
    expect(within(overview).getByRole('img', { name: 'Mon 2 Nov: score 0.3' })).toHaveClass('bg-score-0')
    expect(within(overview).getByRole('img', { name: 'Tue 3 Nov: score 1.0' })).toHaveClass('bg-score-2')
    expect(within(overview).getByRole('img', { name: 'Wed 4 Nov: score 1.3' })).toHaveClass('bg-score-3')
    expect(within(overview).getByRole('img', { name: 'Thu 5 Nov: score 0.5' })).toHaveClass('bg-score-1')
    expect(within(overview).getByRole('img', { name: 'Fri 6 Nov: no score' })).toHaveClass('bg-surface')
    // 1 Nov 2026 is a Sunday: six blanks before it.
    expect(overview.querySelectorAll('[data-blank]')).toHaveLength(6)
  })

  it('shows the distribution and per-habit heatmaps', async () => {
    api()
    renderWithProviders(<MonthPanel />, { route: '/progress?view=month' })

    const distribution = await screen.findByRole('region', { name: 'Distribution' })
    expect(within(distribution).getByRole('listitem', { name: 'Green 2' })).toBeInTheDocument()
    const read = screen.getByRole('region', { name: 'Read' })
    expect(read).toHaveTextContent('50% green')
    expect(within(read).getByRole('img', { name: 'Read, Sun 1 Nov, Target hit' })).toHaveClass('bg-cell-green')
    expect(within(read).getByRole('img', { name: 'Read, Mon 2 Nov, Missed' })).toHaveClass('bg-cell-red')
  })

  it('moves between months', async () => {
    const fetchMock = api()
    const { user } = renderWithProviders(<MonthPanel />, { route: '/progress?view=month' })

    await user.click(await screen.findByRole('button', { name: 'Next month' }))

    expect(await screen.findByRole('button', { name: 'This month' })).toBeInTheDocument()
    expect(requests(fetchMock).map((r) => r.url)).toContain('/api/stats/month?month=2026-12')
  })
})
