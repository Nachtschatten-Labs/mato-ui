import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSolanaClient } from '@solana/react-hooks'
import { resolveSnapshotLocation } from '../api/twob-client'
import { tradingQueries } from '../queries'
import type { Address } from '@solana/kit'

export function useEndSlotBookkeepingSnapshot({
  marketAddress,
  bookkeepingLastUpdateSlot,
  endSlot,
  endSlotInterval,
  isBuy,
  enabled = true,
}: {
  marketAddress: Address
  bookkeepingLastUpdateSlot: number | null
  endSlot: number
  endSlotInterval: number | null
  isBuy: boolean
  enabled?: boolean
}) {
  const client = useSolanaClient()

  const snapshotLocation = useMemo(() => {
    if (endSlotInterval === null) return null
    return resolveSnapshotLocation(endSlot, endSlotInterval)
  }, [endSlot, endSlotInterval])

  return useQuery({
    ...tradingQueries.endSlotSnapshot({
      client,
      bookkeepingLastUpdateSlot,
      endSlot,
      endSlotInterval,
      isBuy,
      marketAddress,
    }),
    enabled: enabled && snapshotLocation !== null,
    refetchInterval: ({ state }) => {
      if (!enabled || snapshotLocation === null) return false
      return state.data == null ? 1_000 : false
    },
  })
}
