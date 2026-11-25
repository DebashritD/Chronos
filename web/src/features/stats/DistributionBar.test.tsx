import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DistributionBar } from './DistributionBar'

describe('DistributionBar', () => {
  it('shows each shape with its count and the Target share', () => {
    render(<DistributionBar title="This week" caption="4 due" distribution={{ green: 2, yellow: 1, red: 1, grey: 0, total: 4 }} />)

    const section = screen.getByRole('region', { name: 'This week' })
    expect(within(section).getByRole('heading', { name: 'This week' })).toBeInTheDocument()
    expect(within(section).getByRole('listitem', { name: 'Target 2' })).toBeInTheDocument()
    expect(within(section).getByRole('listitem', { name: 'Minimum 1' })).toBeInTheDocument()
    expect(within(section).getByRole('listitem', { name: 'Missed 1' })).toBeInTheDocument()
    expect(within(section).getByRole('listitem', { name: 'Unmarked 0' })).toBeInTheDocument()
    expect(within(section).getByText('50%')).toBeInTheDocument()
  })

  it('says when nothing is marked', () => {
    render(<DistributionBar title="This week" caption="4 due" distribution={{ green: 0, yellow: 0, red: 0, grey: 0, total: 0 }} />)

    expect(screen.getByText('Nothing marked yet')).toBeInTheDocument()
  })
})
