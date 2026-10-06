import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSolanaClient } from '@solana/react-hooks'
import { fetchMarketCandles } from '../api/market-repository'
import { tradingQueryRoot } from '../query-keys'
import { SLOT_DURATION_MS, getMarketDefinition } from '../constants'
import { buildPositionChartPoints } from '../lib/position-chart'
import type { MarketPriceSnapshot } from '../domain/models'

export function usePositionChart({
  enabled,
  startSlot,
  currentSlot,
  latestPrice,
}: {
  enabled: boolean
  startSlot: bigint
  currentSlot: number | null
  latestPrice: MarketPriceSnapshot | null
}) {
  const client = useSolanaClient()
  const startTime = useQuery({
    queryKey: [
      ...tradingQueryRoot,
      'position-start-time',
      startSlot.toString(),
    ],
    enabled: enabled && currentSlot !== null,
    staleTime: Infinity,
    retry: false,
    queryFn: async ({ signal }) => {
      try {
        const seconds = await client.runtime.rpc
          .getBlockTime(startSlot)
          .send({ abortSignal: signal })
        if (seconds !== null)
          return { timeMs: Number(seconds) * 1000, estimated: false }
      } catch (error) {
        if (signal.aborted) throw error
      }
      // Skipped or pruned slots may have no timestamp. Keep one stable estimate.
      if (currentSlot === null)
        throw new Error('The position start time is unavailable.')
      return {
        timeMs:
          Date.now() - (currentSlot - Number(startSlot)) * SLOT_DURATION_MS,
        estimated: true,
      }
    },
  })
  const startTimeMs = startTime.data?.timeMs ?? null
  const spanMs = Date.now() - (startTimeMs ?? Date.now())
  const interval =
    spanMs > 1_400 * 300_000 ? '1h' : spanMs > 1_400 * 60_000 ? '5m' : '1m'
  const intervalMs =
    interval === '1h' ? 3_600_000 : interval === '5m' ? 300_000 : 60_000
  const history = useQuery({
    queryKey: [
      ...tradingQueryRoot,
      'position-history',
      getMarketDefinition(1).address,
      startTimeMs,
      interval,
    ],
    enabled: enabled && startTimeMs !== null && startTimeMs <= Date.now(),
    staleTime: 30_000,
    refetchInterval: enabled ? 30_000 : false,
    queryFn: () =>
      fetchMarketCandles({
        from: new Date(startTimeMs!),
        to: new Date(),
        interval,
        marketId: 1,
        maxPoints: 1500,
      }),
  })
  const points = useMemo(
    () =>
      startTimeMs === null
        ? []
        : buildPositionChartPoints(
            history.data ?? [],
            startTimeMs,
            Date.now(),
            latestPrice,
            intervalMs,
          ),
    [history.data, latestPrice, startTimeMs, intervalMs],
  )
  return {
    points,
    startTimeMs,
    estimatedStart: startTime.data?.estimated ?? false,
    isLoading:
      (enabled && currentSlot === null) ||
      startTime.isLoading ||
      history.isLoading,
    hasError: startTime.isError || history.isError,
  }
}
