import { TWOB_ANCHOR_PROGRAM_ADDRESS } from '@/lib/generated/twob/src/generated/programs'
import { tradingQueryRoot } from '../query-keys'
import { useQuery } from '@tanstack/react-query'
import { useSolanaClient } from '@solana/react-hooks'
import { fetchAllMaybeMarket } from '@/lib/generated/twob/src/generated/accounts'
import { MARKET_DEFINITIONS } from '../constants'
import { findMarketAddress } from '../lib/pdas'
import { marketPriceFromFlows } from '../lib/market'
import type { MarketStatsById } from '../lib/market-catalog'

export function useMarketOverview(enabled: boolean) {
  const client = useSolanaClient()
  return useQuery({
    queryKey: [...tradingQueryRoot, 'market-overview'],
    enabled,
    staleTime: 10_000,
    refetchInterval: enabled ? 10_000 : false,
    queryFn: async ({ signal }): Promise<MarketStatsById> => {
      const addresses = await Promise.all(
        MARKET_DEFINITIONS.map(findMarketAddress),
      )
      const accounts = await fetchAllMaybeMarket(
        client.runtime.rpc,
        addresses,
        { commitment: 'confirmed', abortSignal: signal },
      )
      const stats: MarketStatsById = {}
      accounts.forEach((account, index) => {
        const market = MARKET_DEFINITIONS[index]
        if (
          !account.exists ||
          account.programAddress !== TWOB_ANCHOR_PROGRAM_ADDRESS ||
          account.data.id !== market.id ||
          account.data.baseMint !== market.baseMint ||
          account.data.quoteMint !== market.quoteMint
        )
          return
        stats[market.id] = {
          price: marketPriceFromFlows(
            account.data.baseFlow,
            account.data.quoteFlow,
            market.baseDecimals,
            market.quoteDecimals,
          ),
          // Historical statistics are unavailable until sufficient market data exists.
          change24h: null,
          volume24h: null,
        }
      })
      return stats
    },
  })
}
