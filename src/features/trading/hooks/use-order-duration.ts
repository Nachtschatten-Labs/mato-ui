import { useCallback, useEffect, useState } from 'react'
import { SLOT_DURATION_MS, SLOT_DURATION_SECONDS } from '../constants'
import type { OrderSide } from '../constants'
import type { StreamingMarketState } from '../domain/models'
import {
  MAX_DURATION_SLOTS,
  MIN_DURATION_SLOTS,
  recommendDurationSlots,
  SLOTS_PER_MINUTE,
} from '../lib/duration'

interface OrderDurationInputs {
  amountAtoms: bigint | null
  side: OrderSide
  streamingState: StreamingMarketState | null | undefined
  marketKey: string | number
}

interface CustomDuration {
  marketKey: string | number
  side: OrderSide
  slots: number
}

export function useOrderDuration({
  amountAtoms,
  side,
  streamingState,
  marketKey,
}: OrderDurationInputs) {
  const [customDuration, setCustomDuration] = useState<CustomDuration | null>(
    null,
  )
  const hasAmount = amountAtoms !== null && amountAtoms > 0n
  const recommendedSlots = recommendDurationSlots({
    amountAtoms,
    side,
    streamingState,
  })
  const recommendedDurationSeconds =
    recommendedSlots === null ? null : recommendedSlots * SLOT_DURATION_SECONDS

  useEffect(() => {
    setCustomDuration(null)
  }, [hasAmount, marketKey, side])

  const onDurationChange = useCallback(
    (seconds: number) => {
      if (
        !hasAmount ||
        !Number.isFinite(seconds) ||
        seconds <= 0 ||
        seconds > MAX_DURATION_SLOTS * SLOT_DURATION_SECONDS
      ) {
        return
      }

      const rawSlots = (seconds * 1000) / SLOT_DURATION_MS
      // Avoid advancing an exact slot duration due to floating-point noise.
      const wholeSlots = Math.ceil(
        rawSlots - Number.EPSILON * Math.abs(rawSlots),
      )
      const boundedSlots = Math.max(MIN_DURATION_SLOTS, wholeSlots)
      const slots =
        boundedSlots <= SLOTS_PER_MINUTE
          ? boundedSlots
          : Math.ceil(boundedSlots / SLOTS_PER_MINUTE) * SLOTS_PER_MINUTE

      if (slots > MAX_DURATION_SLOTS) return
      setCustomDuration({ marketKey, side, slots })
    },
    [hasAmount, marketKey, side],
  )

  const onResetDuration = useCallback(() => setCustomDuration(null), [])
  const isCustomDuration =
    hasAmount &&
    customDuration !== null &&
    customDuration.marketKey === marketKey &&
    customDuration.side === side
  const durationSeconds = !hasAmount
    ? null
    : isCustomDuration
      ? customDuration.slots * SLOT_DURATION_SECONDS
      : recommendedDurationSeconds

  return {
    durationSeconds,
    recommendedDurationSeconds,
    onDurationChange,
    onResetDuration,
    isCustomDuration,
  }
}
