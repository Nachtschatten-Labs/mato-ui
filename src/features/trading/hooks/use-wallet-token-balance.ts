import { useSplToken, useWalletSession, useWrapSol } from '@solana/react-hooks'
import { WRAPPED_SOL_MINT } from '@solana/client'
import { getSpendableNativeAtoms, getSpendableTokenAtoms } from '../lib/amounts'
import { useWalletSolBalance } from './use-wallet-sol-balance'

// A post-confirmation read can lag, and keepers can settle positions without a
// UI action. Keep cached balances current after either path.
const BALANCE_QUERY_OPTIONS = {
  commitment: 'confirmed',
  revalidateOnFocus: true,
  swr: { refreshInterval: 5_000 },
} as const

export function useWalletTokenBalance(
  mintAddress: string | null | undefined,
  decimals: number,
) {
  const session = useWalletSession()
  const owner = session?.account.address ?? null
  const nativeBalance = useWalletSolBalance()
  const wrappedSol = useWrapSol({
    ...BALANCE_QUERY_OPTIONS,
    owner: owner ?? undefined,
  })
  const splToken = useSplToken(mintAddress ?? WRAPPED_SOL_MINT, {
    ...BALANCE_QUERY_OPTIONS,
    owner: owner ?? undefined,
    config: {
      decimals,
      tokenProgram: 'auto',
    },
  })

  const isNative = mintAddress === WRAPPED_SOL_MINT
  const lamports = nativeBalance.lamports ?? 0n
  const wrappedAtoms = wrappedSol.balance?.amount ?? 0n
  const tokenAtoms = splToken.balance?.amount ?? 0n

  const balanceAtoms = isNative ? lamports + wrappedAtoms : tokenAtoms
  const spendableAtoms = isNative
    ? getSpendableNativeAtoms(
        nativeBalance.lamports ?? null,
        wrappedSol.balance?.amount ?? null,
      )
    : getSpendableTokenAtoms(splToken.balance?.amount ?? null)
  const refresh = async () => {
    if (isNative) {
      await Promise.allSettled([nativeBalance.refresh(), wrappedSol.refresh()])
      return
    }

    await splToken.refresh()
  }

  return {
    balanceAtoms,
    balanceUi: Number(balanceAtoms) / 10 ** decimals,
    existingWrappedAtoms: wrappedAtoms,
    isNative,
    isReady: session !== undefined,
    lamports,
    loading:
      (isNative && (nativeBalance.loading || wrappedSol.isFetching)) ||
      (!isNative && splToken.isFetching),
    refresh,
    spendableAtoms,
    splToken,
    wrappedSol,
  }
}
