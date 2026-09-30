import { useSolanaClient, useWalletSession } from '@solana/react-hooks'
import { useQuery } from '@tanstack/react-query'
import { fetchClosePositionPreview } from '../api/close-position-preview'
import type { Address } from '@solana/kit'

export function useClosePositionPreview({
  enabled,
  marketAddress,
  positionAddress,
}: {
  enabled: boolean
  marketAddress: Address
  positionAddress: Address
}) {
  const client = useSolanaClient()
  const session = useWalletSession()
  const authority = session?.account.address
  return useQuery({
    queryKey: [
      'trading',
      'close-preview',
      marketAddress,
      positionAddress,
      authority,
    ],
    enabled: enabled && Boolean(authority),
    staleTime: 3_000,
    refetchInterval: enabled ? 10_000 : false,
    retry: 1,
    queryFn: ({ signal }) => {
      if (!authority)
        throw new Error('Connect a wallet to review this position.')
      return fetchClosePositionPreview({
        client,
        marketAddress,
        positionAddress,
        authority,
        signal,
      })
    },
  })
}
