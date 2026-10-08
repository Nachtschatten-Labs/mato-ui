import { describe, expect, it } from 'vitest'
import {
  getDurationPriceChangePercent,
  getDurationQuote,
} from './duration-quote'
import type { DurationQuoteInputs } from './duration-quote'
import type { Address } from '@solana/kit'

function quoteInputs(): DurationQuoteInputs {
  return {
    amountAtoms: 1_000n,
    amountUiValue: 1_000,
    durationSeconds: 60,
    indicativePrice: 2,
    side: 'buy',
    streamingState: {
      baseMint: 'So11111111111111111111111111111111111111112' as Address,
      quoteMint: '11111111111111111111111111111111' as Address,
      marketId: 1,
      minimumBaseDepositAtoms: 1n,
      minimumQuoteDepositAtoms: 1n,
      isPaused: false,
      currentSlot: 100,
      endSlotInterval: 11,
      marketBaseFlow: 1_000_000_000_000n,
      marketQuoteFlow: 2_000_000_000_000n,
      bookkeepingBasePerQuote: 0n,
      bookkeepingQuotePerBase: 0n,
      bookkeepingLastUpdateSlot: 100,
      bookkeepingSlotsWithoutTrades: 0,
    },
  }
}

describe('getDurationQuote', () => {
  it('quotes buys at the conservative, impact-adjusted price', () => {
    const quote = getDurationQuote(quoteInputs())
    const userFlow = 1_000 / (300 - 11 / 2)
    const impactRatio = userFlow / 2_000

    expect(quote.priceImpactPercent).toBeCloseTo(impactRatio * 100, 12)
    expect(quote.executionPrice).toBeCloseTo(2 * (1 + impactRatio), 12)
    expect(quote.receiveAmount).toBeCloseTo(1_000 / (2 * (1 + impactRatio)), 12)
  })

  it('quotes sells using the added flow in the denominator', () => {
    const quote = getDurationQuote({ ...quoteInputs(), side: 'sell' })
    const userFlow = 1_000 / (300 - 11 / 2)
    const impactRatio = userFlow / (1_000 + userFlow)

    expect(quote.priceImpactPercent).toBeCloseTo(impactRatio * 100, 12)
    expect(quote.executionPrice).toBeCloseTo(2 * (1 - impactRatio), 12)
    expect(quote.receiveAmount).toBeCloseTo(1_000 * 2 * (1 - impactRatio), 12)
  })

  it.each(['buy', 'sell'] as const)(
    'improves the %s receive estimate as the duration increases',
    (side) => {
      const inputs = { ...quoteInputs(), side }
      const fast = getDurationQuote({ ...inputs, durationSeconds: 5 })
      const slow = getDurationQuote({ ...inputs, durationSeconds: 3_600 })

      expect(slow.priceImpactPercent).toBeLessThan(fast.priceImpactPercent!)
      expect(slow.receiveAmount).toBeGreaterThan(fast.receiveAmount!)
    },
  )

  it.each([null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'does not quote an unavailable or invalid duration (%s)',
    (durationSeconds) => {
      expect(getDurationQuote({ ...quoteInputs(), durationSeconds })).toEqual({
        priceImpactPercent: null,
        executionPrice: null,
        receiveAmount: null,
      })
    },
  )

  it('does not substitute zero impact or the mid-price for missing liquidity', () => {
    expect(
      getDurationQuote({ ...quoteInputs(), streamingState: null }),
    ).toEqual({
      priceImpactPercent: null,
      executionPrice: null,
      receiveAmount: null,
    })
  })

  it.each([null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'requires a valid indicative price for receive estimates (%s)',
    (indicativePrice) => {
      const quote = getDurationQuote({ ...quoteInputs(), indicativePrice })

      expect(quote.priceImpactPercent).not.toBeNull()
      expect(quote.executionPrice).toBeNull()
      expect(quote.receiveAmount).toBeNull()
    },
  )

  it('keeps the base rate available before an amount is entered', () => {
    expect(
      getDurationQuote({
        ...quoteInputs(),
        amountAtoms: null,
        amountUiValue: null,
        durationSeconds: null,
      }),
    ).toEqual({
      priceImpactPercent: null,
      executionPrice: 2,
      receiveAmount: null,
    })
  })
})

describe('getDurationPriceChangePercent', () => {
  it.each([
    ['buy', false, 10],
    ['sell', false, -10],
    ['buy', true, -100 / 11],
    ['sell', true, 100 / 9],
  ] as const)(
    'shows a signed percentage for %s with inverse=%s',
    (side, inverse, expected) => {
      expect(getDurationPriceChangePercent(10, side, inverse)).toBeCloseTo(
        expected,
        12,
      )
    },
  )

  it.each(['buy', 'sell'] as const)(
    'matches the change between the displayed %s prices in both orientations',
    (side) => {
      const inputs = { ...quoteInputs(), side }
      const quote = getDurationQuote(inputs)
      const currentPrice = inputs.indicativePrice!
      const estimatedPrice = quote.executionPrice!

      expect(
        getDurationPriceChangePercent(quote.priceImpactPercent, side),
      ).toBeCloseTo(((estimatedPrice - currentPrice) / currentPrice) * 100, 12)
      expect(
        getDurationPriceChangePercent(quote.priceImpactPercent, side, true),
      ).toBeCloseTo(
        ((1 / estimatedPrice - 1 / currentPrice) / (1 / currentPrice)) * 100,
        12,
      )
    },
  )

  it.each(['buy', 'sell'] as const)(
    'preserves the sign of tiny %s price changes without rounding them to zero',
    (side) => {
      const normal = getDurationPriceChangePercent(1e-14, side)!
      const inverted = getDurationPriceChangePercent(1e-14, side, true)!

      expect(Math.sign(normal)).toBe(side === 'buy' ? 1 : -1)
      expect(Math.sign(inverted)).toBe(side === 'buy' ? -1 : 1)
      expect(Math.abs(inverted)).toBeGreaterThan(0)
      expect(Math.abs(inverted)).toBeLessThan(1e-13)
    },
  )

  it.each([null, Number.NaN, Number.POSITIVE_INFINITY])(
    'keeps an unavailable or non-finite impact (%s) unavailable',
    (impact) => {
      expect(getDurationPriceChangePercent(impact, 'buy')).toBeNull()
      expect(getDurationPriceChangePercent(impact, 'sell', true)).toBeNull()
    },
  )

  it('does not present a percentage for a zero or negative execution price', () => {
    expect(getDurationPriceChangePercent(100, 'sell')).toBeNull()
    expect(getDurationPriceChangePercent(100, 'sell', true)).toBeNull()
    expect(getDurationPriceChangePercent(120, 'sell')).toBeNull()
  })
})
