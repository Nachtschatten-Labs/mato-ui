// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { OrderEntryCard } from './order-entry-card'
import { DURATION_OPTIONS } from '../constants'

afterEach(cleanup)

function createProps(
  overrides: Partial<ComponentProps<typeof OrderEntryCard>> = {},
): ComponentProps<typeof OrderEntryCard> {
  return {
    amountInput: '2',
    amountValidationMessage: null,
    amountTokenTicker: 'SOL',
    availableAmountDisplay: 8,
    canSubmit: true,
    durationSeconds: 3600,
    estimatedConversionText: '~300 USDC',
    executionPriceDisplay: '$150',
    isConnected: true,
    minimumAmountDisplay: '0.1',
    onAmountChange: vi.fn(),
    onDurationChange: vi.fn(),
    onMaxClick: vi.fn(),
    onPercentSelect: vi.fn(),
    onSideChange: vi.fn(),
    onSliderChange: vi.fn(),
    onSubmit: vi.fn(),
    priceImpactDisplay: '0.1%',
    priceImpactWarningText: null,
    receiveBalanceDisplay: 50,
    receiveTokenTicker: 'USDC',
    selectedPercent: 25,
    side: 'sell',
    statusLabel: 'Place order',
    ...overrides,
  }
}

describe('OrderEntryCard', () => {
  it('reveals balance controls and preserves max, preset, slider, and amount callbacks', () => {
    const props = createProps()
    render(<OrderEntryCard {...props} />)

    expect(
      screen.queryByRole('slider', { name: 'Use available balance' }),
    ).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Use maximum balance' }))
    expect(props.onMaxClick).toHaveBeenCalledOnce()

    const percentageButton = screen.getByRole('button', {
      name: 'Choose balance percentage',
    })
    fireEvent.click(percentageButton)
    expect(percentageButton.getAttribute('aria-expanded')).toBe('true')
    expect(
      screen.getByRole('button', { name: '25%' }).getAttribute('aria-pressed'),
    ).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '75%' }))
    expect(props.onPercentSelect).toHaveBeenCalledWith(75)
    fireEvent.change(
      screen.getByRole('slider', { name: 'Use available balance' }),
      {
        target: { value: '42.5' },
      },
    )
    expect(props.onSliderChange).toHaveBeenCalledWith(42.5)
    fireEvent.change(screen.getByRole('textbox', { name: 'You pay' }), {
      target: { value: '4.2' },
    })
    expect(props.onAmountChange).toHaveBeenCalledWith('4.2')
  })

  it('switches sides through the existing callback', () => {
    const props = createProps()
    const view = render(<OrderEntryCard {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to buy' }))
    expect(props.onSideChange).toHaveBeenCalledWith('buy')

    view.rerender(
      <OrderEntryCard
        {...props}
        side="buy"
        amountTokenTicker="USDC"
        receiveTokenTicker="SOL"
      />,
    )
    expect(screen.getByRole('textbox', { name: 'You pay' })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Buy' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Switch to sell' }))
    expect(props.onSideChange).toHaveBeenLastCalledWith('sell')
  })

  it('applies a duration preset only after confirmation and labels the current quote', async () => {
    const props = createProps()
    render(<OrderEntryCard {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Customize duration' }))
    await screen.findByRole('dialog', { name: 'Customize duration' })

    fireEvent.click(screen.getByRole('button', { name: '20 seconds' }))
    expect(props.onDurationChange).not.toHaveBeenCalled()
    expect(screen.getByText('Current estimate · 1 hour')).toBeTruthy()
    expect(
      screen
        .getByRole('slider', { name: 'Order duration' })
        .getAttribute('aria-valuetext'),
    ).toBe('20 seconds')
    fireEvent.click(screen.getByRole('button', { name: 'Use 20 seconds' }))
    expect(props.onDurationChange).toHaveBeenCalledWith(20)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('discards duration slider changes when dismissed and resets the next draft', async () => {
    const props = createProps()
    render(<OrderEntryCard {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Customize duration' }))
    await screen.findByRole('dialog')
    fireEvent.change(screen.getByRole('slider', { name: 'Order duration' }), {
      target: {
        value: String(
          DURATION_OPTIONS.findIndex((option) => option.label === '1w'),
        ),
      },
    })
    expect(screen.getByRole('button', { name: 'Use 1 week' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(props.onDurationChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Customize duration' }))
    await screen.findByRole('dialog')
    expect(
      screen
        .getByRole('slider', { name: 'Order duration' })
        .getAttribute('aria-valuetext'),
    ).toBe('1 hour')
  })

  it('keeps validation accessible and displays the price impact warning', () => {
    render(
      <OrderEntryCard
        {...createProps({
          amountValidationMessage: 'Amount exceeds your available balance.',
          canSubmit: false,
          priceImpactDisplay: '5%',
          priceImpactWarningText:
            'High price impact: consider a longer duration.',
        })}
      />,
    )

    const amount = screen.getByRole('textbox', { name: 'You pay' })
    expect(amount.getAttribute('aria-invalid')).toBe('true')
    expect(
      document.getElementById(amount.getAttribute('aria-describedby') ?? '')
        ?.textContent,
    ).toBe('Amount exceeds your available balance.')
    expect(screen.getByRole('alert').textContent).toContain('High price impact')
    expect(
      screen
        .getByRole('button', { name: 'Place order' })
        .hasAttribute('disabled'),
    ).toBe(true)
  })

  it('only submits when connected and allowed, and preserves pending text', () => {
    const props = createProps({ isConnected: false })
    const view = render(<OrderEntryCard {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Place order' }))
    expect(props.onSubmit).not.toHaveBeenCalled()

    view.rerender(
      <OrderEntryCard
        {...props}
        isConnected
        canSubmit={false}
        statusLabel="Submitting…"
      />,
    )
    expect(
      screen
        .getByRole('button', { name: 'Submitting…' })
        .hasAttribute('disabled'),
    ).toBe(true)
    view.rerender(<OrderEntryCard {...props} isConnected />)
    fireEvent.click(screen.getByRole('button', { name: 'Place order' }))
    expect(props.onSubmit).toHaveBeenCalledOnce()
  })
})
