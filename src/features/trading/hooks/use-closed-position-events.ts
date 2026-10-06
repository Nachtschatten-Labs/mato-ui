import { useQuery } from '@tanstack/react-query'
import { tradingQueries } from '../queries'

export function useClosedPositionEvents({
  beforeSlot,
  positionAuthority,
  marketId,
  limit = 50,
}: {
  beforeSlot?: number
  positionAuthority: string
  marketId?: number
  limit?: number
}) {
  return useQuery({
    ...tradingQueries.closedPositions({
      beforeSlot,
      limit,
      marketId,
      positionAuthority,
    }),
    enabled: Boolean(positionAuthority),
  })
}
