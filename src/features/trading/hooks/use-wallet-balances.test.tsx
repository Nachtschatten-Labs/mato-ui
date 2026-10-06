// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { WRAPPED_SOL_MINT } from '@solana/client'
import { useWalletSolBalance } from './use-wallet-sol-balance'
import { useWalletTokenBalance } from './use-wallet-token-balance'

const mocks = vi.hoisted(() => ({
  owner: '11111111111111111111111111111111' as string | undefined,
  fetchBalance: vi.fn(async () => 590_000_000n),
  refreshWrapped: vi.fn(async () => {}),
  refreshToken: vi.fn(async () => {}),
}))

vi.mock('@solana/react-hooks', () => ({
  useWalletSession: () =>
    mocks.owner ? { account: { address: mocks.owner } } : undefined,
  useSolanaClient: () => ({ actions: { fetchBalance: mocks.fetchBalance } }),
  // The installed useBalance API has no refresh method.
  useBalance: () => ({ lamports: 590_000_000n, fetching: false }),
  useWrapSol: () => ({
    balance: { amount: 0n },
    isFetching: false,
    refresh: mocks.refreshWrapped,
  }),
  useSplToken: () => ({
    balance: { amount: 100_000_000n },
    isFetching: false,
    refresh: mocks.refreshToken,
  }),
}))

beforeEach(() => {
  mocks.owner = '11111111111111111111111111111111'
  vi.clearAllMocks()
})
afterEach(cleanup)

it('refreshes native SOL through the client action', async () => {
  const { result } = renderHook(() => useWalletSolBalance())
  await act(async () => result.current.refresh())
  expect(mocks.fetchBalance).toHaveBeenCalledWith(mocks.owner, 'confirmed')
})

it('refreshes native and wrapped balances used for SOL order sizing', async () => {
  const { result } = renderHook(() =>
    useWalletTokenBalance(WRAPPED_SOL_MINT, 9),
  )
  await act(async () => result.current.refresh())
  expect(mocks.fetchBalance).toHaveBeenCalledWith(mocks.owner, 'confirmed')
  expect(mocks.refreshWrapped).toHaveBeenCalledOnce()
  expect(result.current.spendableAtoms).toBe(570_000_000n)
})

it('does not fetch a native balance while disconnected', async () => {
  mocks.owner = undefined
  const { result } = renderHook(() => useWalletSolBalance())
  await act(async () => result.current.refresh())
  expect(mocks.fetchBalance).not.toHaveBeenCalled()
})
