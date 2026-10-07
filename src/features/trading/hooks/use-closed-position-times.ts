import { useQuery } from '@tanstack/react-query'
import { useSolanaClient } from '@solana/react-hooks'
import { SLOT_DURATION_MS } from '../constants'
import { tradingQueryRoot } from '../query-keys'
import type { ClosePositionEvent } from '@/integrations/read-api'

function validSlot(slot: number | null) {
  return slot !== null && Number.isSafeInteger(slot) && slot >= 0 ? slot : null
}

function useClosedPositionBlockTime(slot: number | null) {
  const client = useSolanaClient()

  return useQuery<number | null>({
    // Cache only RPC results by slot. Estimates belong to the close event that
    // supplies their timestamp anchor, and must not leak into another position.
    queryKey: [...tradingQueryRoot, 'closed-position-block-time', slot],
    enabled: slot !== null,
    staleTime: (query) => (query.state.data === null ? 60_000 : Infinity),
    retry: false,
    queryFn: async ({ signal }) => {
      if (slot === null) return null

      try {
        const seconds = await client.runtime.rpc
          .getBlockTime(BigInt(slot))
          .send({ abortSignal: signal })
        if (seconds !== null) {
          const timeMs = Number(seconds) * 1000
          if (Number.isFinite(new Date(timeMs).getTime())) return timeMs
        }
      } catch (error) {
        if (signal.aborted) throw error
      }

      return null
    },
  })
}

export function useClosedPositionTimes(event: ClosePositionEvent) {
  const closeSlot = validSlot(event.slot)
  const scheduledEndSlot = validSlot(event.end_slot)
  const endSlot =
    closeSlot !== null && scheduledEndSlot !== null
      ? Math.min(scheduledEndSlot, closeSlot)
      : null
  const reportedStartSlot = validSlot(event.start_slot)
  // A position canceled before it starts has no trading start time.
  const startSlot =
    reportedStartSlot !== null &&
    closeSlot !== null &&
    reportedStartSlot <= closeSlot &&
    (endSlot === null || reportedStartSlot <= endSlot)
      ? reportedStartSlot
      : null
  const startQuery = useClosedPositionBlockTime(startSlot)
  const endQuery = useClosedPositionBlockTime(endSlot)
  const parsedCloseTime = Date.parse(event.created_at)
  const closeTimeMs = Number.isFinite(parsedCloseTime) ? parsedCloseTime : null

  const resolveTime = (
    slot: number | null,
    blockTime: number | null | undefined,
  ) => {
    if (slot === null) return { timeMs: null, estimated: false }
    if (blockTime !== null && blockTime !== undefined)
      return { timeMs: blockTime, estimated: false }
    if (closeSlot === null || closeTimeMs === null)
      return { timeMs: null, estimated: false }

    const timeMs = closeTimeMs - (closeSlot - slot) * SLOT_DURATION_MS
    if (!Number.isFinite(new Date(timeMs).getTime()))
      return { timeMs: null, estimated: false }

    return { timeMs, estimated: slot !== closeSlot }
  }
  const start = resolveTime(startSlot, startQuery.data)
  const end = resolveTime(endSlot, endQuery.data)

  return {
    startTimeMs: start.timeMs,
    endTimeMs: end.timeMs,
    estimatedStart: start.estimated,
    estimatedEnd: end.estimated,
    isLoading: startQuery.isLoading || endQuery.isLoading,
  }
}
