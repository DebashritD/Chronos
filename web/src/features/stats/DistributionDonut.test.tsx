import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DistributionDonut } from './DistributionDonut'

describe('DistributionDonut', () => {
  it('shows each color with its count and the green share in the middle', () => {
    render(<DistributionDonut title="This week" distribution={{ green: 2, yellow: 1, red: 1, grey: 0, total: 4 }} />)

    const section = screen.getByRole('region', { name: 'This week' })
    expect(within(section).getByRole('heading', { name: 'This week' })).toBeInTheDocument()
    expect(within(section).getByRole('listitem', { name: 'Green 2' })).toBeInTheDocument()
    expect(within(section).getByRole('listitem', { name: 'Yellow 1' })).toBeInTheDocument()
    expect(within(section).getByRole('listitem', { name: 'Red 1' })).toBeInTheDocument()
    expect(within(section).getByRole('listitem', { name: 'Unmarked 0' })).toBeInTheDocument()
    expect(within(section).getByText('50%')).toBeInTheDocument()
  })

  it('says when nothing is marked', () => {
    render(<DistributionDonut title="This week" distribution={{ green: 0, yellow: 0, red: 0, grey: 0, total: 0 }} />)

    expect(screen.getByText('Nothing marked yet')).toBeInTheDocument()
  })
})
