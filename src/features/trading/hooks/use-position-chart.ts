import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSolanaClient } from '@solana/react-hooks'
import { fetchMarketUpdateRange } from '../api/market-repository'
import { tradingQueryRoot } from '../query-keys'
import { SLOT_DURATION_MS, getMarketDefinition } from '../constants'
import { buildPositionChartPoints } from '../lib/position-chart'
import type { MarketPriceSnapshot } from '../domain/models'

export function usePositionChart({
  enabled,
  startSlot,
  endSlot,
  paused,
  currentSlot,
  latestPrice,
  marketId,
}: {
  enabled: boolean
  startSlot: bigint
  endSlot: bigint
  paused: boolean
  currentSlot: number | null
  latestPrice: MarketPriceSnapshot | null
  marketId: number
}) {
  const client = useSolanaClient()
  const market = getMarketDefinition(marketId)
  const firstSlot = Number(startSlot)
  const lastSlot = Number(endSlot)
  const hasEnded = !paused && currentSlot !== null && currentSlot >= lastSlot
  const throughSlot = Math.max(
    firstSlot,
    hasEnded ? lastSlot : (currentSlot ?? firstSlot),
  )
  const indexedThroughEnd = hasEnded && (latestPrice?.slot ?? -1) >= lastSlot
  const [observed, setObserved] = useState<{
    key: string
    prices: MarketPriceSnapshot[]
  }>({ key: '', prices: [] })
  const observationKey = `${market.address}:${startSlot}`
  useEffect(() => {
    if (!enabled || latestPrice?.slot == null || latestPrice.slot < firstSlot)
      return
    if (hasEnded && latestPrice.slot >= lastSlot) return
    setObserved((previous) => ({
      key: observationKey,
      prices: [
        ...(previous.key === observationKey
          ? previous.prices.filter((price) => price.slot !== latestPrice.slot)
          : []),
        latestPrice,
      ].slice(-1500),
    }))
  }, [enabled, latestPrice, firstSlot, lastSlot, hasEnded, observationKey])

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
      if (currentSlot === null)
        throw new Error('The position start time is unavailable.')
      return {
        timeMs: Date.now() - (currentSlot - firstSlot) * SLOT_DURATION_MS,
        estimated: true,
      }
    },
  })
  const endTime = useQuery({
    queryKey: [...tradingQueryRoot, 'position-end-time', endSlot.toString()],
    enabled: enabled && hasEnded,
    staleTime: Infinity,
    retry: false,
    queryFn: async ({ signal }) => {
      try {
        const seconds = await client.runtime.rpc
          .getBlockTime(endSlot)
          .send({ abortSignal: signal })
        if (seconds !== null)
          return { timeMs: Number(seconds) * 1000, estimated: false }
      } catch (error) {
        if (signal.aborted) throw error
      }
      return {
        timeMs:
          Date.now() -
          ((currentSlot ?? lastSlot) - lastSlot) * SLOT_DURATION_MS,
        estimated: true,
      }
    },
  })
  const history = useQuery({
    queryKey: [
      ...tradingQueryRoot,
      'position-slot-history',
      market.address,
      firstSlot,
      lastSlot,
      hasEnded,
      indexedThroughEnd,
    ],
    enabled: enabled && currentSlot !== null && currentSlot >= firstSlot,
    placeholderData: (previous, query) =>
      query?.queryKey[4] === market.address && query.queryKey[5] === firstSlot
        ? previous
        : undefined,
    staleTime: indexedThroughEnd ? Infinity : 5_000,
    // Fetch once more after the indexer passes the end, then freeze this range.
    refetchInterval: enabled && !indexedThroughEnd ? 5_000 : false,
    queryFn: () =>
      fetchMarketUpdateRange({
        startSlot: firstSlot,
        endSlot: throughSlot,
        marketId,
      }),
  })
  const points = useMemo(
    () =>
      buildPositionChartPoints({
        events: history.data ?? [],
        livePrices: [
          ...(observed.key === observationKey ? observed.prices : []),
          ...(latestPrice ? [latestPrice] : []),
        ],
        startSlot: firstSlot,
        endSlot: throughSlot,
        includeEndSlot: !hasEnded,
        baseDecimals: market.baseDecimals,
        quoteDecimals: market.quoteDecimals,
      }),
    [
      history.data,
      observed,
      observationKey,
      latestPrice,
      firstSlot,
      throughSlot,
      hasEnded,
      market,
    ],
  )

  return {
    points,
    startSlot: firstSlot,
    endSlot: Math.max(lastSlot, throughSlot),
    startTimeMs: startTime.data?.timeMs ?? null,
    endTimeMs: hasEnded ? (endTime.data?.timeMs ?? null) : null,
    estimatedStart: startTime.data?.estimated ?? false,
    estimatedEnd: !hasEnded || (endTime.data?.estimated ?? true),
    hasEnded,
    isLoading: (enabled && currentSlot === null) || history.isLoading,
    hasError: history.isError,
  }
}
