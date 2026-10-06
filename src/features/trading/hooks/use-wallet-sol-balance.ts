import {
  useBalance,
  useSolanaClient,
  useWalletSession,
} from '@solana/react-hooks'

export function useWalletSolBalance() {
  const client = useSolanaClient()
  const session = useWalletSession()
  const owner = session?.account.address ?? null
  const nativeBalance = useBalance(owner ?? undefined)
  const refresh = async () => {
    if (owner) await client.actions.fetchBalance(owner, 'confirmed')
  }

  return {
    isReady: session !== undefined,
    lamports: nativeBalance.lamports ?? null,
    loading: nativeBalance.fetching,
    refresh,
  }
}
