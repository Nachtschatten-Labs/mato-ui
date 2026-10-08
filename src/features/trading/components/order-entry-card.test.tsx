// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import type { Address } from '@solana/kit'
import { OrderEntryCard } from './order-entry-card'
import { MAX_ORDER_DURATION_SECONDS } from '../constants'

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
    durationQuoteInputs: {
      amountAtoms: 2_000_000_000n,
      amountUiValue: 2,
      indicativePrice: 150,
      streamingState: {
        baseMint: 'So11111111111111111111111111111111111111112' as Address,
        quoteMint: '11111111111111111111111111111111' as Address,
        marketId: 1,
        minimumBaseDepositAtoms: 1n,
        minimumQuoteDepositAtoms: 1n,
        isPaused: false,
        currentSlot: 100,
        endSlotInterval: 11,
        marketBaseFlow: 1_000_000_000_000_000_000n,
        marketQuoteFlow: 2_000_000_000_000_000_000n,
        bookkeepingBasePerQuote: 0n,
        bookkeepingQuotePerBase: 0n,
        bookkeepingLastUpdateSlot: 100,
        bookkeepingSlotsWithoutTrades: 0,
      },
    },
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

  it.each([
    [10.4, '10.4 seconds'],
    [75 * 60, '1 h 15 min'],
    [86400, '24 hours'],
  ])(
    'shows the exact custom duration %s as %s after applying',
    (durationSeconds, label) => {
      render(
        <OrderEntryCard
          {...createProps({ durationSeconds, isCustomDuration: true })}
        />,
      )
      expect(
        screen.getByRole('button', { name: `Customize duration: ${label}` })
          .textContent,
      ).toBe(label)
    },
  )

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

  it('previews a reset and restores live Smart fill only when the choice is applied', async () => {
    const props = createProps({
      isCustomDuration: true,
      recommendedDurationSeconds: 10.4,
      onResetDuration: vi.fn(),
    })
    render(<OrderEntryCard {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /^Customize duration/ }))
    await screen.findByRole('dialog')
    fireEvent.click(
      screen.getByRole('button', { name: /^Reset to 10\.4 seconds/ }),
    )
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(
      screen
        .getByRole('slider', { name: 'Order duration' })
        .getAttribute('aria-valuenow'),
    ).toBe('10.4')
    expect(screen.queryByRole('button', { name: /^Reset to/ })).toBeNull()
    expect(props.onResetDuration).not.toHaveBeenCalled()
    expect(props.onDurationChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /^Customize duration/ }))
    await screen.findByRole('dialog')
    expect(
      screen
        .getByRole('slider', { name: 'Order duration' })
        .getAttribute('aria-valuenow'),
    ).toBe('3600')
    fireEvent.click(
      screen.getByRole('button', { name: /^Reset to 10\.4 seconds/ }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Use 10.4 seconds' }))
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

  it.each(['buy', 'sell'] as const)(
    'previews the %s estimated price and receive amount before applying a duration',
    async (side) => {
      const props = createProps({
        side,
        amountTokenTicker: side === 'buy' ? 'USDC' : 'SOL',
        receiveTokenTicker: side === 'buy' ? 'SOL' : 'USDC',
      })
      render(<OrderEntryCard {...props} />)
      fireEvent.click(
        screen.getByRole('button', { name: /^Customize duration/ }),
      )
      const dialog = await screen.findByRole('dialog', {
        name: /^Customize duration/,
      })
      const slider = within(dialog).getByRole('slider', {
        name: 'Order duration',
      })
      const receive =
        within(dialog).getByText('Est. receive').nextElementSibling!
      const originalReceive = receive.textContent
      const originalImpact = slider.getAttribute('aria-valuetext')
      const comparison = within(dialog).getByRole('group', {
        name: 'Price comparison',
      })
      const currentPrice =
        within(comparison).getByText('Price now').nextElementSibling!
      const estimatedPrice =
        within(comparison).getByText('Est. price').nextElementSibling!
      const originalEstimatedPrice = Number(
        estimatedPrice.firstElementChild!.textContent,
      )
      expect(currentPrice.textContent).toBe('150')
      expect(within(comparison).getByText('USDC per SOL')).toBeTruthy()
      expect(
        estimatedPrice.contains(
          within(comparison).getByLabelText('Price impact'),
        ),
      ).toBe(true)
      expect(receive.textContent).not.toContain('%')

      fireEvent.keyDown(slider, { key: 'Home' })
      expect(props.onDurationChange).not.toHaveBeenCalled()
      expect(slider.getAttribute('aria-valuenow')).toBe('5')
      expect(slider.getAttribute('aria-valuetext')).not.toBe(originalImpact)
      expect(slider.getAttribute('aria-valuetext')).toContain('price impact')
      expect(receive.textContent).not.toBe(originalReceive)
      expect(Number(receive.textContent!.match(/^~([\d.]+)/)![1])).toBeLessThan(
        Number(originalReceive!.match(/^~([\d.]+)/)![1]),
      )
      const shortEstimatedPrice = Number(
        estimatedPrice.firstElementChild!.textContent,
      )
      expect(currentPrice.textContent).toBe('150')
      if (side === 'buy') {
        expect(shortEstimatedPrice).toBeGreaterThan(150)
      } else {
        expect(shortEstimatedPrice).toBeLessThan(150)
      }
      expect(Math.abs(originalEstimatedPrice - 150)).toBeLessThan(
        Math.abs(shortEstimatedPrice - 150),
      )
      expect(
        within(dialog).queryByRole('button', { name: '5 seconds' }),
      ).toBeNull()
      expect(within(dialog).getAllByRole('button')).toHaveLength(3)
      fireEvent.click(screen.getByRole('button', { name: 'Use 5 seconds' }))
      expect(props.onDurationChange).toHaveBeenCalledExactlyOnceWith(5)
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    },
  )

  it('refreshes prices, impact and receive while keeping the open duration draft', async () => {
    const props = createProps()
    const view = render(<OrderEntryCard {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /^Customize duration/ }))
    const dialog = await screen.findByRole('dialog')
    const slider = within(dialog).getByRole('slider', {
      name: 'Order duration',
    })
    fireEvent.keyDown(slider, { key: 'Home' })
    const comparison = within(dialog).getByRole('group', {
      name: 'Price comparison',
    })
    const currentPrice =
      within(comparison).getByText('Price now').nextElementSibling!
    const estimatedPrice =
      within(comparison).getByText('Est. price').nextElementSibling!
    const receive = within(dialog).getByText('Est. receive').nextElementSibling!
    const previousEstimatedPrice = estimatedPrice.textContent
    const previousReceive = receive.textContent
    const previousImpact = slider.getAttribute('aria-valuetext')

    view.rerender(
      <OrderEntryCard
        {...props}
        durationQuoteInputs={{
          ...props.durationQuoteInputs!,
          indicativePrice: 175,
          streamingState: {
            ...props.durationQuoteInputs!.streamingState!,
            marketBaseFlow: 2_000_000_000_000_000_000n,
            marketQuoteFlow: 4_000_000_000_000_000_000n,
          },
        }}
      />,
    )

    expect(screen.getByRole('dialog')).toBe(dialog)
    expect(currentPrice.textContent).toBe('175')
    expect(estimatedPrice.textContent).not.toBe(previousEstimatedPrice)
    expect(receive.textContent).not.toBe(previousReceive)
    expect(slider.getAttribute('aria-valuetext')).not.toBe(previousImpact)
    expect(slider.getAttribute('aria-valuenow')).toBe('5')
    expect(
      within(dialog).getByRole('button', { name: 'Use 5 seconds' }),
    ).toBeTruthy()
    expect(props.onDurationChange).not.toHaveBeenCalled()
  })

  it('discards duration slider changes when dismissed and resets the next draft', async () => {
    const props = createProps()
    render(<OrderEntryCard {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /^Customize duration/ }))
    await screen.findByRole('dialog')
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Order duration' }), {
      key: 'End',
    })
    expect(screen.getByRole('button', { name: 'Use 1 year' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(props.onDurationChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /^Customize duration/ }))
    await screen.findByRole('dialog')
    expect(
      screen
        .getByRole('slider', { name: 'Order duration' })
        .getAttribute('aria-valuenow'),
    ).toBe('3600')
  })

  it('updates the estimated price impact color and three-decimal value with the duration', async () => {
    render(<OrderEntryCard {...createProps({ durationSeconds: 4 * 3600 })} />)
    fireEvent.click(screen.getByRole('button', { name: /^Customize duration/ }))
    const dialog = await screen.findByRole('dialog')
    const slider = within(dialog).getByRole('slider', {
      name: 'Order duration',
    })

    expect(
      within(dialog).getByText('(−0.003%)').classList.contains('text-positive'),
    ).toBe(true)
    fireEvent.keyDown(slider, { key: 'Home' })
    expect(
      within(dialog)
        .getByText('(−9.302%)')
        .classList.contains('text-destructive'),
    ).toBe(true)
    fireEvent.keyDown(slider, { key: 'End' })
    expect(
      within(dialog)
        .getByText('(−<0.001%)')
        .classList.contains('text-positive'),
    ).toBe(true)
  })

  it('keeps an exact off-grid Smart fill duration when stepping away and back', async () => {
    const props = createProps({
      durationSeconds: 10.4,
      recommendedDurationSeconds: 10.4,
      onResetDuration: vi.fn(),
    })
    render(<OrderEntryCard {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /^Customize duration/ }))
    const slider = await screen.findByRole('slider', { name: 'Order duration' })

    expect(slider.getAttribute('aria-valuenow')).toBe('10.4')
    expect(
      screen.getByRole('button', { name: 'Use 10.4 seconds' }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Reset to/ })).toBeNull()
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(slider.getAttribute('aria-valuenow')).toBe('20')
    expect(
      screen.getByRole('button', { name: /^Reset to 10\.4 seconds/ }),
    ).toBeTruthy()
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    expect(slider.getAttribute('aria-valuenow')).toBe('10.4')
    fireEvent.click(screen.getByRole('button', { name: 'Use 10.4 seconds' }))
    expect(props.onResetDuration).toHaveBeenCalledOnce()
    expect(props.onDurationChange).not.toHaveBeenCalled()
  })

  it('shows missing quote data as unavailable rather than zero impact', async () => {
    render(
      <OrderEntryCard {...createProps({ durationQuoteInputs: undefined })} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^Customize duration/ }))
    const dialog = await screen.findByRole('dialog')
    const slider = within(dialog).getByRole('slider', {
      name: 'Order duration',
    })

    expect(slider.getAttribute('aria-valuetext')).toBe(
      '1 hour, price impact unavailable',
    )
    expect(
      within(dialog).getByText(
        'Price impact is unavailable with current liquidity.',
      ),
    ).toBeTruthy()
    expect(
      within(dialog).getByText('Est. receive').nextElementSibling?.textContent,
    ).toBe('— USDC')
    expect(within(dialog).queryByText(/0\.000%/)).toBeNull()
    const comparison = within(dialog).getByRole('group', {
      name: 'Price comparison',
    })
    expect(
      within(comparison).getByText('Price now').nextElementSibling?.textContent,
    ).toBe('—')
    expect(
      within(comparison).getByText('Est. price').nextElementSibling
        ?.textContent,
    ).toBe('—')
  })

  it('keeps the current price but hides the estimate when liquidity is unavailable', async () => {
    const props = createProps()
    render(
      <OrderEntryCard
        {...props}
        durationQuoteInputs={{
          ...props.durationQuoteInputs!,
          streamingState: null,
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^Customize duration/ }))
    const dialog = await screen.findByRole('dialog')
    const comparison = within(dialog).getByRole('group', {
      name: 'Price comparison',
    })
    const currentPrice =
      within(comparison).getByText('Price now').nextElementSibling!
    const estimatedPrice =
      within(comparison).getByText('Est. price').nextElementSibling!

    expect(currentPrice.textContent).toBe('150')
    expect(estimatedPrice.textContent).toBe('—')
    fireEvent.click(
      within(comparison).getByRole('button', { name: 'Flip price' }),
    )
    expect(currentPrice.textContent).toBe('0.006667')
    expect(estimatedPrice.textContent).toBe('—')
  })

  it('blocks durations that exceed the amount supported by the stream', async () => {
    const props = createProps()
    render(
      <OrderEntryCard
        {...props}
        durationQuoteInputs={{
          ...props.durationQuoteInputs!,
          amountAtoms: 20_000n,
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^Customize duration/ }))
    const slider = await screen.findByRole('slider', { name: 'Order duration' })
    fireEvent.keyDown(slider, { key: 'End' })

    expect(slider.getAttribute('aria-valuenow')).toBe(
      String(MAX_ORDER_DURATION_SECONDS),
    )
    expect(screen.getByRole('status').textContent).toContain(
      'amount is too small',
    )
    const comparison = screen.getByRole('group', { name: 'Price comparison' })
    const estimatedPrice =
      within(comparison).getByText('Est. price').nextElementSibling!
    expect(
      within(comparison).getByText('Price now').nextElementSibling?.textContent,
    ).toBe('150')
    expect(estimatedPrice.textContent).toBe('—')
    const apply = screen.getByRole('button', { name: 'Use 1 year' })
    expect(apply.hasAttribute('disabled')).toBe(true)
    fireEvent.click(apply)
    expect(props.onDurationChange).not.toHaveBeenCalled()

    fireEvent.keyDown(slider, { key: 'Home' })
    expect(screen.queryByRole('status')).toBeNull()
    expect(estimatedPrice.textContent).not.toBe('—')
    expect(
      screen
        .getByRole('button', { name: 'Use 5 seconds' })
        .hasAttribute('disabled'),
    ).toBe(false)
  })

  it.each(['buy', 'sell'] as const)(
    'flips both current and estimated prices together for a %s',
    async (side) => {
      render(
        <OrderEntryCard
          {...createProps({
            side,
            durationSeconds: 5,
            amountTokenTicker: side === 'buy' ? 'USDC' : 'SOL',
            receiveTokenTicker: side === 'buy' ? 'SOL' : 'USDC',
          })}
        />,
      )
      fireEvent.click(
        screen.getByRole('button', { name: /^Customize duration/ }),
      )
      const dialog = await screen.findByRole('dialog')
      const comparison = within(dialog).getByRole('group', {
        name: 'Price comparison',
      })
      const currentPrice =
        within(comparison).getByText('Price now').nextElementSibling!
      const estimatedPrice =
        within(comparison).getByText('Est. price').nextElementSibling!
      const originalEstimatedPrice =
        estimatedPrice.firstElementChild!.textContent!
      const receive =
        within(dialog).getByText('Est. receive').nextElementSibling!
      const originalReceive = receive.textContent
      const flip = within(comparison).getByRole('button', {
        name: 'Flip price',
      })
      expect(currentPrice.textContent).toBe('150')
      expect(within(comparison).getByText('USDC per SOL')).toBeTruthy()
      const impact = within(comparison).getByLabelText('Price impact')
      expect(estimatedPrice.contains(impact)).toBe(true)
      const normalImpact = side === 'buy' ? '+5.128%' : '−9.302%'
      expect(impact.textContent).toBe(`(${normalImpact})`)
      const slider = within(dialog).getByRole('slider', {
        name: 'Order duration',
      })
      expect(slider.getAttribute('aria-valuetext')).toContain(normalImpact)
      expect(receive.textContent).not.toContain('%')

      fireEvent.click(flip)
      expect(within(comparison).getByText('SOL per USDC')).toBeTruthy()
      expect(currentPrice.textContent).toBe('0.006667')
      expect(Number(estimatedPrice.firstElementChild!.textContent)).toBeCloseTo(
        1 / Number(originalEstimatedPrice),
        6,
      )
      expect(estimatedPrice.textContent).not.toBe(currentPrice.textContent)
      expect(receive.textContent).toBe(originalReceive)
      const inverseImpact = side === 'buy' ? '−4.878%' : '+10.256%'
      expect(impact.textContent).toBe(`(${inverseImpact})`)
      expect(slider.getAttribute('aria-valuetext')).toContain(inverseImpact)
      expect(impact.classList.contains('text-destructive')).toBe(true)

      fireEvent.click(flip)
      expect(within(comparison).getByText('USDC per SOL')).toBeTruthy()
      expect(currentPrice.textContent).toBe('150')
      expect(estimatedPrice.firstElementChild!.textContent).toBe(
        originalEstimatedPrice,
      )
      expect(impact.textContent).toBe(`(${normalImpact})`)
    },
  )

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
