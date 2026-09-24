// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchMarketCandles } from '../api/market-repository'
import { CHART_RANGES, CHART_TIMEFRAMES } from '../constants'
import { useMarketChartHistory } from './use-market-chart-history'

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
      const now = Date.parse('2026-09-24T12:00:00Z')
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
