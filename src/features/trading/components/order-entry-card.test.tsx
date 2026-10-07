// @vitest-environment jsdom

import {
  act,
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
  it('shows Smart fill without a duration until an amount is entered', async () => {
    const props = createProps({ amountInput: '', side: 'buy' })
    const view = render(<OrderEntryCard {...props} />)

    expect(screen.getByText('Smart fill')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Smart fill' })).toBeNull()
    const smartFillInfo = screen.getByRole('button', {
      name: 'About Smart fill',
    })
    expect(screen.queryByText('Over the next')).toBeNull()
    expect(
      screen.queryByRole('button', { name: /^Customize duration/ }),
    ).toBeNull()
    fireEvent.keyDown(document.body, { key: 'Tab' })
    act(() => smartFillInfo.focus())
    expect(
      await screen.findByText(
        'Your buy streams continuously over time instead of filling all at once.',
      ),
    ).toBeTruthy()

    view.rerender(
      <OrderEntryCard {...props} amountInput="1" durationSeconds={10} />,
    )
    expect(screen.getByText('Over the next')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Customize duration: 10 seconds' })
        .textContent,
    ).toBe('10 seconds')
    expect(
      screen.queryByRole('button', { name: 'About Smart fill' }),
    ).toBeNull()

    view.rerender(<OrderEntryCard {...props} amountInput="0" />)
    expect(screen.getByText('Smart fill')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'About Smart fill' }),
    ).toBeTruthy()
    expect(screen.queryByText('Over the next')).toBeNull()
  })

  it.each([
    [13.2, '15 seconds'],
    [60, '1 minute'],
    [61 * 60, '1 hour 30 minutes'],
    [7 * 86400, 'week'],
    [39 * 86400, '1 month 1 week 2 days'],
    [365 * 86400, '1 year'],
  ])('shows %s seconds as the clickable label %s', (durationSeconds, label) => {
    render(<OrderEntryCard {...createProps({ durationSeconds })} />)
    expect(
      screen.getByRole('button', { name: `Customize duration: ${label}` })
        .textContent,
    ).toBe(label)
  })

  it('does not invent a duration when a recommendation is unavailable', () => {
    render(
      <OrderEntryCard
        {...createProps({
          durationSeconds: null,
          durationUnavailableMessage: 'Waiting for market liquidity…',
        })}
      />,
    )
    expect(screen.queryByText('Over the next')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Customize duration' }).textContent,
    ).toBe('Choose duration')
    expect(screen.getByRole('status').textContent).toBe(
      'Waiting for market liquidity…',
    )
  })

  it('can return a custom duration to the live Smart fill recommendation', async () => {
    const props = createProps({
      isCustomDuration: true,
      recommendedDurationSeconds: 10.4,
      onResetDuration: vi.fn(),
    })
    render(<OrderEntryCard {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /^Customize duration/ }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: /Smart fill/ }))
    expect(props.onResetDuration).toHaveBeenCalledOnce()
    expect(props.onDurationChange).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('explains that the one-year cap can exceed the price impact target', async () => {
    const year = 365 * 86400
    render(
      <OrderEntryCard
        {...createProps({
          durationSeconds: year,
          recommendedDurationSeconds: year,
          onResetDuration: vi.fn(),
          priceImpactDisplay: '0.020%',
        })}
      />,
    )
    expect(screen.getByText('Price impact 0.020%')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Customize duration: 1 year' }),
    )
    await screen.findByRole('dialog')
    expect(
      screen.getByText('Maximum duration. Price impact may exceed 0.01%.'),
    ).toBeTruthy()
    expect(
      screen.queryByText('Recommended for less than 0.01% price impact'),
    ).toBeNull()
  })

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

  it('switches sides using the Buy/Sell control without resetting the active side', () => {
    const props = createProps()
    const view = render(<OrderEntryCard {...props} />)
    expect(screen.getByRole('group', { name: 'Order side' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Sell', pressed: true }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Switch to/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sell' }))
    expect(props.onSideChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Buy', pressed: false }))
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
    expect(
      screen.getByRole('button', { name: 'Buy', pressed: true }),
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Sell', pressed: false }),
    )
    expect(props.onSideChange).toHaveBeenLastCalledWith('sell')
  })

  it('applies a duration preset only after confirmation and labels the current quote', async () => {
    const props = createProps()
    render(<OrderEntryCard {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /^Customize duration/ }))
    await screen.findByRole('dialog', { name: /^Customize duration/ })

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
    fireEvent.click(screen.getByRole('button', { name: /^Customize duration/ }))
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

    fireEvent.click(screen.getByRole('button', { name: /^Customize duration/ }))
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
