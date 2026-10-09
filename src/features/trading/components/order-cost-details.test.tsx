// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { OrderCostDetails } from './order-cost-details'

afterEach(cleanup)

const props = {
  hasAmount: true,
  baseTicker: 'SOL',
  quoteTicker: 'USDC',
  receiveTokenTicker: 'SOL',
  indicativePrice: 2,
  priceImpactDisplay: '1.00%',
  priceImpactCost: 0.5,
  hasHighPriceImpact: false,
  feePercent: 0.1,
  feeAmount: 0.0495,
}

describe('OrderCostDetails', () => {
  it.each(['SOL', 'USDC'])(
    'expands costs in receiving %s and flips only the detail rate',
    (receiveTokenTicker) => {
      render(
        <OrderCostDetails {...props} receiveTokenTicker={receiveTokenTicker} />,
      )
      const trigger = screen.getByRole('button', {
        name: 'Price impact and fee details',
      })
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      expect(screen.queryByText('Price impact')).toBeNull()
      fireEvent.click(trigger)
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
      const details = document.getElementById(
        trigger.getAttribute('aria-controls')!,
      )!
      expect(
        within(details).getByText('Price impact').nextElementSibling
          ?.textContent,
      ).toBe(`−1.00%· ≈0.5 ${receiveTokenTicker}`)
      expect(
        within(details).getByText('Fee').nextElementSibling?.textContent,
      ).toBe(
        `0.1%· ≈${receiveTokenTicker === 'USDC' ? '0.05' : '0.0495'} ${receiveTokenTicker}`,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Flip rate' }))
      expect(within(details).getByText('1 USDC ≈ 0.5 SOL')).toBeTruthy()
      expect(trigger.textContent).toContain('Impact −1.00%')
      fireEvent.click(trigger)
      expect(screen.queryByText('Price impact')).toBeNull()
    },
  )

  it('keeps small costs visible and marks unavailable estimates', () => {
    const view = render(<OrderCostDetails {...props} feeAmount={0.00000001} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Price impact and fee details' }),
    )
    expect(screen.getByText('· ≈<0.000001 SOL')).toBeTruthy()
    view.rerender(
      <OrderCostDetails
        {...props}
        indicativePrice={null}
        priceImpactCost={null}
        priceImpactDisplay="—"
        feePercent={null}
        feeAmount={null}
      />,
    )
    expect(screen.getAllByText('· — SOL')).toHaveLength(2)
    expect(screen.queryByText(/≈0 SOL/)).toBeNull()
  })
})
