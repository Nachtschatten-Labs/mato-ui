import { useQuery } from '@tanstack/react-query'
import { tradingQueries } from '../queries'
import type { MarketId } from '../constants'

export function useMarketAddress(marketId: MarketId) {
  return useQuery(tradingQueries.marketAddress(marketId))
}
