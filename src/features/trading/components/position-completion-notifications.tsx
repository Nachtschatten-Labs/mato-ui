import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useEndSlotBookkeepingSnapshot } from '../hooks/use-end-slot-bookkeeping-snapshot'
import { formatAtoms, formatPrice } from '../lib/format'
import { getActivePositionMetrics } from '../lib/position-progress'
import {
  getTradePositionEndSlot,
  isBuyTradePosition,
  isPausedTradePosition,
} from '../lib/trade-position'
import type { Address } from '@solana/kit'
import type {
  StreamingMarketState,
  TradePositionRecord,
} from '../domain/models'

interface PositionCompletionNotificationsProps {
  baseDecimals: number
  baseTicker: string
  marketAddress: Address
  positions: TradePositionRecord[]
  quoteDecimals: number
  quoteTicker: string
  streamingState: StreamingMarketState
}

function positionKey(position: TradePositionRecord) {
  return `${position.address}:${position.data.startSlot}`
}

function hasPositionEnded(position: TradePositionRecord, currentSlot: number) {
  return (
    !isPausedTradePosition(position.data) &&
    currentSlot >= Number(getTradePositionEndSlot(position.data))
  )
}

// Mount once per wallet/market after both positions and market state load.
// Keeping this outside the position list also covers hidden tabs and pages.
export function PositionCompletionNotifications({
  positions,
  ...props
}: PositionCompletionNotificationsProps) {
  const [initiallyEnded] = useState(
    () =>
      new Set(
        positions
          .filter((position) =>
            hasPositionEnded(position, props.streamingState.currentSlot),
          )
          .map(positionKey),
      ),
  )
  const notifiedPositions = useRef(new Set<string>())
  const [pendingPositions, setPendingPositions] = useState(
    () => new Map<string, TradePositionRecord>(),
  )

  useEffect(() => {
    setPendingPositions((previous) => {
      const next = new Map(previous)
      for (const position of positions) {
        const key = positionKey(position)
        if (
          !initiallyEnded.has(key) &&
          !notifiedPositions.current.has(key) &&
          hasPositionEnded(position, props.streamingState.currentSlot)
        ) {
          next.set(key, position)
        } else {
          next.delete(key)
        }
      }
      return next.size === previous.size &&
        [...next].every(([key, position]) => previous.get(key) === position)
        ? previous
        : next
    })
  }, [initiallyEnded, positions, props.streamingState.currentSlot])

  const notify = useCallback((key: string, description: string) => {
    if (notifiedPositions.current.has(key)) return
    notifiedPositions.current.add(key)
    setPendingPositions((previous) => {
      if (!previous.has(key)) return previous
      const next = new Map(previous)
      next.delete(key)
      return next
    })
    toast.success('Position ended', {
      description,
      id: `position-ended-${key}`,
    })
  }, [])

  // A keeper can close the account before its end snapshot arrives. Preserve
  // observed ends until the toast is ready, but never extrapolate missing live
  // positions: they may have been closed early.
  const observedPositions = new Map(pendingPositions)
  for (const position of positions) {
    observedPositions.set(positionKey(position), position)
  }

  return [...observedPositions.values()]
    .filter((position) => !initiallyEnded.has(positionKey(position)))
    .map((position) => (
      <PositionCompletionObserver
        key={positionKey(position)}
        {...props}
        onComplete={notify}
        position={position}
      />
    ))
}

function PositionCompletionObserver({
  position,
  onComplete,
  ...props
}: Omit<PositionCompletionNotificationsProps, 'positions'> & {
  onComplete: (key: string, description: string) => void
  position: TradePositionRecord
}) {
  const { baseTicker, marketAddress, quoteTicker, streamingState } = props
  const endSlot = Number(getTradePositionEndSlot(position.data))
  const hasEnded = hasPositionEnded(position, streamingState.currentSlot)
  const snapshot = useEndSlotBookkeepingSnapshot({
    bookkeepingLastUpdateSlot: streamingState.bookkeepingLastUpdateSlot,
    enabled: hasEnded,
    endSlot,
    endSlotInterval: streamingState.endSlotInterval,
    isBuy: isBuyTradePosition(position.data),
    marketAddress,
  })
  const metrics = getActivePositionMetrics({
    ...props,
    endSlotBookkeepingSnapshot: snapshot.data ?? null,
    market: marketAddress,
    position: position.data,
  })
  let description: string | null = null
  if (
    hasEnded &&
    snapshot.data?.slot === endSlot &&
    metrics.consumedAtoms !== null &&
    metrics.swappedAtoms !== null
  ) {
    const spent = formatAtoms(
      metrics.consumedAtoms,
      metrics.depositedDecimals,
      metrics.depositedDecimals,
    )
    const swapped = formatAtoms(
      metrics.swappedAtoms,
      metrics.swappedDecimals,
      metrics.swappedDecimals,
    )
    // Lifetime gross output includes earlier withdrawals. Their individually
    // rounded fees cannot be reconstructed from the position account.
    description =
      `Swapped ${spent} ${metrics.depositedToken} into ${swapped} ${metrics.swappedToken} (before fees). ` +
      (metrics.averagePrice === null
        ? 'Average price unavailable.'
        : `Average price: ${formatPrice(metrics.averagePrice)} ${quoteTicker}/${baseTicker}.`)
  }
  const key = positionKey(position)
  useEffect(() => {
    if (description !== null) onComplete(key, description)
  }, [description, key, onComplete])

  return null
}
