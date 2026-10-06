import { useSplToken, useWalletSession, useWrapSol } from '@solana/react-hooks'
import { WRAPPED_SOL_MINT } from '@solana/client'
import { getSpendableNativeAtoms, getSpendableTokenAtoms } from '../lib/amounts'
import { useWalletSolBalance } from './use-wallet-sol-balance'

export function useWalletTokenBalance(
  mintAddress: string | null | undefined,
  decimals: number,
) {
  const session = useWalletSession()
  const owner = session?.account.address ?? null
  const nativeBalance = useWalletSolBalance()
  const wrappedSol = useWrapSol({ owner: owner ?? undefined })
  const splToken = useSplToken(mintAddress ?? WRAPPED_SOL_MINT, {
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
