// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchMarketCandles } from '../api/market-repository'
import {
  CHART_RANGES,
  CHART_TIMEFRAMES,
  getMarketDefinition,
} from '../constants'
import { useMarketChartHistory } from './use-market-chart-history'
import type { MarketCandle } from '../api/market-repository'
import type { MarketPriceSnapshot } from '../domain/models'

vi.mock('../api/market-repository', () => ({
  fetchMarketCandles: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('chart range history', () => {
  it.each([
    { label: '1H', durationMs: 60 * 60 * 1000 },
    { label: '1D', durationMs: 24 * 60 * 60 * 1000 },
    { label: '1W', durationMs: 7 * 24 * 60 * 60 * 1000 },
  ])(
    'loads the full $label range before displaying it',
    async ({ label, durationMs }) => {
      const range = CHART_RANGES.find((option) => option.label === label)!
      const timeframe = CHART_TIMEFRAMES.find(
        (option) => option.label === range.timeframe,
      )!
      const now = Date.parse('2026-11-20T12:00:00Z')
      vi.spyOn(Date, 'now').mockReturnValue(now)
      vi.mocked(fetchMarketCandles).mockResolvedValue([])

      const { result } = renderHook(() =>
        useMarketChartHistory({ marketId: 1, timeframe: range.timeframe }),
      )

      await waitFor(() => {
        expect(result.current.isLoadingMoreHistory).toBe(false)
      })

      expect(range.visibleBars * timeframe.intervalMs).toBe(durationMs)
      expect(fetchMarketCandles).toHaveBeenCalledOnce()
      const [request] = vi.mocked(fetchMarketCandles).mock.calls[0]
      expect(request.interval).toBe(range.timeframe)
      expect(request.from.getTime()).toBeLessThan(now - durationMs)
      expect(request.to.getTime()).toBeGreaterThanOrEqual(now)
    },
  )
})

const historyStartMs = getMarketDefinition(1).chartHistoryStartMs!

function candle(timeMs: number, price = 150): MarketCandle {
  return {
    time: timeMs / 1000,
    open: price,
    high: price,
    low: price,
    close: price,
    volume: 0,
  }
}

describe('main chart history reset', () => {
  it.each(CHART_TIMEFRAMES)(
    'limits the initial $label history and excludes buckets crossing the cutoff',
    async ({ label, intervalMs }) => {
      const firstFullBucketMs =
        Math.ceil(historyStartMs / intervalMs) * intervalMs
      vi.spyOn(Date, 'now').mockReturnValue(historyStartMs + 90 * 60_000)
      vi.mocked(fetchMarketCandles).mockResolvedValue([
        candle(firstFullBucketMs - intervalMs, 9999),
        candle(firstFullBucketMs),
      ])

      const { result } = renderHook(() =>
        useMarketChartHistory({ marketId: 1, timeframe: label }),
      )
      await waitFor(() => {
        expect(result.current.isLoadingMoreHistory).toBe(false)
      })

      expect(fetchMarketCandles).toHaveBeenCalledOnce()
      expect(fetchMarketCandles).toHaveBeenCalledWith(
        expect.objectContaining({
          from: new Date('2026-11-11T08:35:03Z'),
          interval: label,
        }),
      )
      expect(result.current.candles).toEqual([candle(firstFullBucketMs)])
      expect(result.current.hasMoreHistory).toBe(false)
    },
  )

  it('stops loading older history at the fixed cutoff', async () => {
    const firstFullBucketMs = Math.ceil(historyStartMs / 60_000) * 60_000
    vi.spyOn(Date, 'now').mockReturnValue(historyStartMs + 4 * 60 * 60_000)
    const recent = Array.from({ length: 60 }, (_, index) =>
      candle(firstFullBucketMs + (120 + index) * 60_000),
    )
    vi.mocked(fetchMarketCandles)
      .mockResolvedValueOnce(recent)
      .mockResolvedValueOnce([
        candle(firstFullBucketMs - 60_000, 9999),
        candle(firstFullBucketMs),
      ])

    const { result } = renderHook(() =>
      useMarketChartHistory({ marketId: 1, timeframe: '1m' }),
    )
    await waitFor(() => {
      expect(result.current.isLoadingMoreHistory).toBe(false)
    })
    expect(result.current.hasMoreHistory).toBe(true)

    await act(async () => {
      await result.current.loadOlderHistory({ visibleBarCount: 300 })
    })

    expect(fetchMarketCandles).toHaveBeenLastCalledWith(
      expect.objectContaining({
        from: new Date(historyStartMs),
        to: new Date(recent[0].time * 1000),
      }),
    )
    expect(result.current.candles).toEqual([
      candle(firstFullBucketMs),
      ...recent,
    ])
    expect(result.current.hasMoreHistory).toBe(false)

    await act(async () => {
      await result.current.loadOlderHistory({ visibleBarCount: 300 })
    })
    expect(fetchMarketCandles).toHaveBeenCalledTimes(2)
  })

  it.each(CHART_TIMEFRAMES)(
    'ignores stale live prices and starts a fresh partial $label candle at the cutoff',
    async ({ label, intervalMs }) => {
      vi.spyOn(Date, 'now').mockReturnValue(historyStartMs + 1000)
      vi.mocked(fetchMarketCandles).mockResolvedValue([])
      const stalePrice: MarketPriceSnapshot = {
        eventTimeMs: historyStartMs - 1,
        price: 9999,
        slot: 1,
      }
      const { result, rerender } = renderHook(
        ({ latestPrice }: { latestPrice: MarketPriceSnapshot }) =>
          useMarketChartHistory({
            latestPrice,
            marketId: 1,
            timeframe: label,
          }),
        { initialProps: { latestPrice: stalePrice } },
      )
      await waitFor(() => {
        expect(result.current.isLoadingMoreHistory).toBe(false)
      })
      expect(result.current.candles).toEqual([])

      rerender({
        latestPrice: { eventTimeMs: historyStartMs, price: 150, slot: 2 },
      })
      rerender({
        latestPrice: {
          eventTimeMs: historyStartMs + 1000,
          price: 151,
          slot: 3,
        },
      })
      expect(result.current.candles).toEqual([
        {
          ...candle(historyStartMs),
          close: 151,
          high: 151,
          startSlot: 2,
          endSlot: 3,
        },
      ])

      rerender({ latestPrice: stalePrice })
      expect(result.current.candles[0].high).toBe(151)

      const nextBucketMs = Math.ceil(historyStartMs / intervalMs) * intervalMs
      rerender({
        latestPrice: { eventTimeMs: nextBucketMs, price: 152, slot: 4 },
      })
      expect(result.current.candles).toHaveLength(2)
      expect(result.current.candles[1]).toMatchObject({
        time: nextBucketMs / 1000,
        open: 151,
        close: 152,
      })
    },
  )
})
