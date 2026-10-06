import { useCallback, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useSendTransaction,
  useSolanaClient,
  useWalletSession,
} from '@solana/react-hooks'
import {
  END_SLOT_INTERVAL,
  MAX_RECLAIM_RENT_ACCOUNTS_PER_TRANSACTION,
} from '../constants'
import { sendReclaimRent } from '../api/twob-client'
import { formatTransactionError } from '../lib/transaction-errors'
import { collectCloseableMarketIntervals } from '../lib/rent'
import { tradingQueryKeys } from '../query-keys'
import { tradingQueries } from '../queries'
import { useMarketAddress } from './use-market-address'
import type { MarketId } from '../constants'
import { fetchMarket } from '@/lib/generated/twob/src/generated/accounts'

type ReclaimRentStatus =
  'idle' | 'building' | 'submitting' | 'success' | 'error'

const RENT_RUNTIME_QUERY_KEY = 'rent-runtime-context'

export function useReclaimRent(enabled: boolean, marketId: MarketId) {
  const client = useSolanaClient()
  const session = useWalletSession()
  const sendTransaction = useSendTransaction()
  const queryClient = useQueryClient()
  const marketAddressQuery = useMarketAddress(marketId)
  const marketAddress = marketAddressQuery.data
  const ownerAddress = session?.account.address.toString() ?? null
  const shouldFetch = enabled && Boolean(ownerAddress)

  const [status, setStatus] = useState<ReclaimRentStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [reclaimedLamports, setReclaimedLamports] = useState(0n)

  const intervalsQuery = useQuery({
    ...tradingQueries.ownedMarketIntervals({ authority: ownerAddress, client }),
    enabled: shouldFetch,
    refetchInterval: shouldFetch ? 10_000 : false,
    refetchIntervalInBackground: true,
  })
  const runtimeContextQuery = useQuery({
    queryKey: [RENT_RUNTIME_QUERY_KEY, marketAddress ?? 'none'],
    queryFn: async () => {
      if (!marketAddress) {
        throw new Error('Market address not available.')
      }

      const [currentSlot] = await Promise.all([
        client.runtime.rpc.getSlot({ commitment: 'confirmed' }).send(),
        fetchMarket(client.runtime.rpc, marketAddress, {
          commitment: 'confirmed',
        }),
      ])
      return {
        currentSlot: Number(currentSlot),
        endSlotInterval: END_SLOT_INTERVAL,
      }
    },
    enabled: shouldFetch && Boolean(marketAddress),
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
  })

  const intervalAccounts = useMemo(
    () =>
      (intervalsQuery.data ?? []).map((account) => ({
        address: account.address,
        index: account.data.index,
        lamports: account.lamports,
        market: account.data.market,
        openPositions: account.data.openPositions,
        payer: account.data.payer,
      })),
    [intervalsQuery.data],
  )
  const closeableCount = useMemo(() => {
    if (!marketAddress || !runtimeContextQuery.data || !session) return 0
    return collectCloseableMarketIntervals({
      ...runtimeContextQuery.data,
      intervalAccounts,
      market: marketAddress,
      payer: session.account.address,
    }).length
  }, [intervalAccounts, marketAddress, runtimeContextQuery.data, session])

  const reclaimRent = useCallback(async () => {
    if (!session) {
      setStatus('error')
      setError('Connect a wallet to reclaim rent.')
      return false
    }
    if (!marketAddress) {
      setStatus('error')
      setError('Market address is not available yet.')
      return false
    }

    setStatus('building')
    setError(null)
    setSignature(null)
    setReclaimedLamports(0n)

    try {
      setStatus('submitting')
      const result = await sendReclaimRent({
        client,
        request: {
          marketAddress,
          maxAccounts: MAX_RECLAIM_RENT_ACCOUNTS_PER_TRANSACTION,
        },
        session,
      })

      setStatus('success')
      setReclaimedLamports(result.reclaimedLamports)
      setSignature(result.signature)

      const connectedAddress = session.account.address.toString()
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: tradingQueryKeys.ownedMarketIntervals(connectedAddress),
        }),
        queryClient.invalidateQueries({
          queryKey: [RENT_RUNTIME_QUERY_KEY, marketAddress],
        }),
      ])
      return true
    } catch (caughtError) {
      setStatus('error')
      setError(formatTransactionError(caughtError, 'Failed to reclaim rent.'))
      return false
    }
  }, [client, marketAddress, queryClient, session])

  const reset = useCallback(() => {
    sendTransaction.reset()
    setStatus('idle')
    setError(null)
    setSignature(null)
    setReclaimedLamports(0n)
  }, [sendTransaction])

  const clearFeedback = useCallback(() => {
    setStatus('idle')
    setError(null)
    setSignature(null)
    setReclaimedLamports(0n)
  }, [])

  return {
    closeableCount,
    clearFeedback,
    error,
    isLoadingEligibility:
      shouldFetch &&
      (intervalsQuery.isPending || runtimeContextQuery.isPending),
    isReclaiming: status === 'building' || status === 'submitting',
    reclaimRent,
    reclaimedLamports,
    reset,
    signature,
    status,
  }
}
