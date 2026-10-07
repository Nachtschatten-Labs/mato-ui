// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Address } from '@solana/kit'
import type { StreamingMarketState } from '../domain/models'
import {
  MAX_DURATION_SLOTS,
  MIN_DURATION_SLOTS,
  SLOTS_PER_MINUTE,
} from '../lib/duration'
import { SLOT_DURATION_SECONDS } from '../constants'
import { useOrderDuration } from './use-order-duration'
import { formatSmartDuration } from '../lib/duration-label'

afterEach(cleanup)

function createStreamingState(
  overrides: Partial<StreamingMarketState> = {},
): StreamingMarketState {
  return {
    baseMint: 'So11111111111111111111111111111111111111112' as Address,
    quoteMint: '11111111111111111111111111111111' as Address,
    marketId: 1,
    minimumBaseDepositAtoms: 1n,
    minimumQuoteDepositAtoms: 1n,
    isPaused: false,
    currentSlot: 100,
    endSlotInterval: 10,
    marketBaseFlow: 100_000_000_000_000n,
    marketQuoteFlow: 100_000_000_000_000n,
    bookkeepingBasePerQuote: 0n,
    bookkeepingQuotePerBase: 0n,
    bookkeepingLastUpdateSlot: 100,
    bookkeepingSlotsWithoutTrades: 0,
    ...overrides,
  }
}

function createInputs(
  overrides: Partial<Parameters<typeof useOrderDuration>[0]> = {},
): Parameters<typeof useOrderDuration>[0] {
  return {
    amountAtoms: 250n,
    side: 'buy',
    streamingState: createStreamingState(),
    marketKey: 'market-1',
    ...overrides,
  }
}

describe('useOrderDuration', () => {
  it('shows few seconds for the minimum 25-slot order at 200 ms per slot', () => {
    const { result } = renderHook(useOrderDuration, {
      initialProps: createInputs({ amountAtoms: 30n }),
    })
    expect(result.current.durationSeconds).toBe(5)
    expect(formatSmartDuration(result.current.durationSeconds!)).toBe(
      'few seconds',
    )
  })

  it('keeps the automatic duration at one year as oversized orders grow', () => {
    const inputs = createInputs({
      amountAtoms: BigInt(MAX_DURATION_SLOTS) * 20n,
    })
    const { result, rerender } = renderHook(useOrderDuration, {
      initialProps: inputs,
    })

    expect(result.current.durationSeconds).toBe(365 * 24 * 60 * 60)
    expect(result.current.isCustomDuration).toBe(false)
    rerender({ ...inputs, amountAtoms: inputs.amountAtoms! * 2n })
    expect(result.current.durationSeconds).toBe(365 * 24 * 60 * 60)
    expect(result.current.recommendedDurationSeconds).toBe(
      result.current.durationSeconds,
    )
  })

  it('recommends again as the amount and market liquidity change', () => {
    const inputs = createInputs()
    const { result, rerender } = renderHook(useOrderDuration, {
      initialProps: inputs,
    })
    expect(result.current.durationSeconds).toBeCloseTo(
      31 * SLOT_DURATION_SECONDS,
    )
    expect(result.current.isCustomDuration).toBe(false)

    const largerAmount = BigInt(SLOTS_PER_MINUTE - 5) * 10n
    rerender({ ...inputs, amountAtoms: largerAmount })
    expect(result.current.durationSeconds).toBe(120)

    rerender({
      ...inputs,
      amountAtoms: largerAmount,
      streamingState: createStreamingState({
        marketQuoteFlow: 200_000_000_000_000n,
      }),
    })
    expect(result.current.durationSeconds).toBeCloseTo(
      (SLOTS_PER_MINUTE / 2 + 3) * SLOT_DURATION_SECONDS,
    )
  })

  it('retains a manual choice while the amount and recommendation change, then restores smart fill', () => {
    const inputs = createInputs()
    const { result, rerender } = renderHook(useOrderDuration, {
      initialProps: inputs,
    })
    act(() => result.current.onDurationChange(60))
    expect(result.current.isCustomDuration).toBe(true)

    rerender({ ...inputs, amountAtoms: BigInt(2 * SLOTS_PER_MINUTE - 5) * 10n })
    expect(result.current.durationSeconds).toBe(60)
    expect(result.current.recommendedDurationSeconds).toBe(180)

    act(() => result.current.onResetDuration())
    expect(result.current.durationSeconds).toBe(180)
    expect(result.current.isCustomDuration).toBe(false)
  })

  it.each([null, 0n, -1n])(
    'hides and clears a custom duration when the amount becomes %s',
    (amountAtoms) => {
      const inputs = createInputs()
      const { result, rerender } = renderHook(useOrderDuration, {
        initialProps: inputs,
      })
      act(() => result.current.onDurationChange(600))
      rerender({ ...inputs, amountAtoms })
      expect(result.current.durationSeconds).toBeNull()
      expect(result.current.recommendedDurationSeconds).toBeNull()
      expect(result.current.isCustomDuration).toBe(false)
      act(() => result.current.onDurationChange(120))

      rerender(inputs)
      expect(result.current.durationSeconds).toBeCloseTo(
        31 * SLOT_DURATION_SECONDS,
      )
      expect(result.current.isCustomDuration).toBe(false)
    },
  )

  it.each([{ side: 'sell' as const }, { marketKey: 'market-2' }])(
    'clears a manual choice when the order context changes to %o',
    (change) => {
      const inputs = createInputs()
      const { result, rerender } = renderHook(useOrderDuration, {
        initialProps: inputs,
      })
      act(() => result.current.onDurationChange(600))
      rerender({ ...inputs, ...change })
      expect(result.current.isCustomDuration).toBe(false)
      expect(result.current.durationSeconds).toBe(
        result.current.recommendedDurationSeconds,
      )

      rerender(inputs)
      expect(result.current.isCustomDuration).toBe(false)
      expect(result.current.durationSeconds).toBeCloseTo(
        31 * SLOT_DURATION_SECONDS,
      )
    },
  )

  it.each([
    [0.1, MIN_DURATION_SLOTS * SLOT_DURATION_SECONDS],
    [50.5 * SLOT_DURATION_SECONDS, 51 * SLOT_DURATION_SECONDS],
    [66 * SLOT_DURATION_SECONDS, 66 * SLOT_DURATION_SECONDS],
    [60 - SLOT_DURATION_SECONDS / 2, 60],
    [60, 60],
    [60.1, 120],
    [61, 120],
    [120.1, 180],
    [
      MAX_DURATION_SLOTS * SLOT_DURATION_SECONDS,
      MAX_DURATION_SLOTS * SLOT_DURATION_SECONDS,
    ],
  ])(
    'normalizes a custom duration of %s seconds to %s seconds',
    (input, expected) => {
      const { result } = renderHook(useOrderDuration, {
        initialProps: createInputs(),
      })
      act(() => result.current.onDurationChange(input))
      expect(result.current.durationSeconds).toBeCloseTo(expected)
      expect(result.current.isCustomDuration).toBe(true)
    },
  )

  it.each([
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    (MAX_DURATION_SLOTS + 1) * SLOT_DURATION_SECONDS,
  ])('ignores an invalid custom duration of %s', (input) => {
    const { result } = renderHook(useOrderDuration, {
      initialProps: createInputs(),
    })
    act(() => result.current.onDurationChange(60))
    act(() => result.current.onDurationChange(input))
    expect(result.current.durationSeconds).toBe(60)
    expect(result.current.isCustomDuration).toBe(true)
  })

  it.each([
    null,
    undefined,
    createStreamingState({ marketBaseFlow: 0n }),
    createStreamingState({ marketQuoteFlow: 0n }),
    createStreamingState({ marketBaseFlow: -1n }),
  ])(
    'withholds automatic duration without usable market liquidity',
    (streamingState) => {
      const inputs = createInputs({ streamingState })
      const { result, rerender } = renderHook(useOrderDuration, {
        initialProps: inputs,
      })
      expect(result.current.durationSeconds).toBeNull()
      expect(result.current.recommendedDurationSeconds).toBeNull()

      rerender(createInputs())
      expect(result.current.durationSeconds).toBeCloseTo(
        31 * SLOT_DURATION_SECONDS,
      )
      act(() => result.current.onDurationChange(120))
      rerender(inputs)
      expect(result.current.durationSeconds).toBe(120)
      expect(result.current.recommendedDurationSeconds).toBeNull()
    },
  )
})
