import { useQuery } from '@tanstack/react-query'
import { useSolanaClient } from '@solana/react-hooks'
import { tradingQueries } from '../queries'
import type { Address } from '@solana/kit'

export function useTradePositions(
  authority: string | null | undefined,
  marketAddress: Address | undefined,
) {
  const client = useSolanaClient()

  return useQuery({
    ...tradingQueries.tradePositions({
      authority,
      client,
      marketAddress,
    }),
    enabled: Boolean(authority && marketAddress),
    refetchInterval: 5_000,
  })
}
