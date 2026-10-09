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
import type { OrderCostDetailsProps } from './order-cost-details'

afterEach(cleanup)

const props: OrderCostDetailsProps = {
  hasAmount: true,
  baseTicker: 'SOL',
  quoteTicker: 'USDC',
  receiveTokenTicker: 'SOL',
  indicativePrice: 2,
  executionPrice: 2.02,
  side: 'buy',
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
      const side = receiveTokenTicker === 'SOL' ? 'buy' : 'sell'
      const executionPrice = side === 'buy' ? 2.02 : 1.98
      const sign = side === 'buy' ? '+' : '−'
      render(
        <OrderCostDetails
          {...props}
          side={side}
          executionPrice={executionPrice}
          receiveTokenTicker={receiveTokenTicker}
        />,
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
      expect(within(details).getByText('Estimated Rate')).toBeTruthy()
      expect(
        within(details).getByText(`1 SOL ≈ ${executionPrice} USDC`),
      ).toBeTruthy()
      expect(
        screen.getByText('2').closest('span')?.parentElement?.textContent,
      ).toBe('1 SOL ≈ 2 USDC')
      expect(
        within(details).getByText('Price impact').nextElementSibling
          ?.textContent,
      ).toBe(`${sign}1.00%· ≈0.5 ${receiveTokenTicker}`)
      expect(
        within(details).getByText('Fee').nextElementSibling?.textContent,
      ).toBe(
        `0.1%· ≈${receiveTokenTicker === 'USDC' ? '0.05' : '0.0495'} ${receiveTokenTicker}`,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Flip rate' }))
      expect(
        within(details).getByText(
          `1 USDC ≈ ${side === 'buy' ? '0.49505' : '0.505051'} SOL`,
        ),
      ).toBeTruthy()
      expect(trigger.textContent).toContain(`Impact ${sign}1.00%`)
      expect(
        screen.getByText('2').closest('span')?.parentElement?.textContent,
      ).toBe('1 SOL ≈ 2 USDC')
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
        executionPrice={null}
        priceImpactCost={null}
        priceImpactDisplay="—"
        feePercent={null}
        feeAmount={null}
      />,
    )
    expect(screen.getAllByText('· — SOL')).toHaveLength(2)
    expect(screen.queryByText(/≈0 SOL/)).toBeNull()
    expect(screen.getByText('1 SOL ≈ — USDC')).toBeTruthy()
  })

  it('does not substitute the market rate for an unavailable estimated rate', () => {
    render(<OrderCostDetails {...props} executionPrice={null} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Price impact and fee details' }),
    )
    expect(screen.getByText('1 SOL ≈ — USDC')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Flip rate' }))
    expect(screen.getByText('1 USDC ≈ — SOL')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it.each([
    [
      'About Estimated Rate',
      'The estimated rate after price impact, before fees. The final rate can change while your stream runs.',
    ],
    [
      'About price impact',
      "Your stream's estimated effect on the SOL price in USDC. The cost is how much less SOL you receive because of price impact, before fees.",
    ],
    [
      'About fee',
      'The fee is deducted from the SOL you receive and is already included in Est. receive.',
    ],
  ])(
    'opens %s on tap and keeps its explanation hidden until then',
    async (label, text) => {
      render(<OrderCostDetails {...props} />)
      fireEvent.click(
        screen.getByRole('button', { name: 'Price impact and fee details' }),
      )
      expect(screen.queryByText(text)).toBeNull()
      const info = screen.getByRole('button', { name: label })
      fireEvent.pointerDown(info, { pointerType: 'touch' })
      fireEvent.pointerUp(info, { pointerType: 'touch' })
      fireEvent.click(info)
      const popup = await screen.findByRole('dialog', { name: label })
      expect(within(popup).getByText(text)).toBeTruthy()
    },
  )
})
