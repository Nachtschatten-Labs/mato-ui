// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createDefaultClientStore, WRAPPED_SOL_MINT } from '@solana/client'
import { SolanaProvider } from '@solana/react-hooks'
import { lamports } from '@solana/kit'
import type { SolanaClient, WalletSession } from '@solana/client'
import type { Address } from '@solana/kit'
import type { ReactNode } from 'react'
import { getMarketDefinition } from '../constants'
import { useWalletTokenBalance } from './use-wallet-token-balance'

const OWNER = '11111111111111111111111111111112' as Address
const USDC = getMarketDefinition(1).quoteMint
const ANT = getMarketDefinition(0).baseMint

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.clearAllTimers()
  vi.useRealTimers()
})

function setup() {
  const balances = new Map<string, bigint>([
    [USDC, 100_000_000n],
    [ANT, 10_000_000n],
    [WRAPPED_SOL_MINT, 0n],
  ])
  const store = createDefaultClientStore({
    commitment: 'confirmed',
    endpoint: 'https://rpc.example.com',
  })
  store.setState({
    wallet: {
      status: 'connected',
      connectorId: 'test',
      session: { account: { address: OWNER } } as WalletSession,
    },
    accounts: {
      [OWNER]: {
        address: OWNER,
        data: undefined,
        executable: false,
        fetching: false,
        lamports: lamports(1_000_000_000n),
        owner: null,
        slot: 1n,
      },
    },
  })
  const fetchToken = vi.fn(async (mint: string) => ({
    amount: balances.get(mint) ?? 0n,
    ataAddress: OWNER,
    decimals: 6,
    exists: true,
    uiAmount: String(Number(balances.get(mint) ?? 0n) / 1_000_000),
  }))
  const fetchWrapped = vi.fn(async () => ({
    amount: balances.get(WRAPPED_SOL_MINT) ?? 0n,
    ataAddress: OWNER,
    exists: true,
  }))
  const client = {
    store,
    actions: { fetchBalance: vi.fn(async () => 1_000_000_000n) },
    watchers: { watchBalance: () => ({ abort() {} }) },
    splToken: ({ mint }: { mint: string }) => ({
      fetchBalance: () => fetchToken(mint),
    }),
    wsol: { fetchWsolBalance: fetchWrapped },
  } as unknown as SolanaClient
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SolanaProvider client={client} walletPersistence={false}>
      {children}
    </SolanaProvider>
  )
  return { balances, fetchToken, fetchWrapped, store, wrapper }
}

async function advance(ms = 0) {
  await act(async () => vi.advanceTimersByTimeAsync(ms))
}

it.each([USDC, ANT])(
  'recovers a stale post-transaction balance for %s without reloading',
  async (mint) => {
    const { balances, wrapper } = setup()
    const { result } = renderHook(() => useWalletTokenBalance(mint, 6), {
      wrapper,
    })
    await advance()
    const before = balances.get(mint)!
    expect(result.current.balanceAtoms).toBe(before)

    // The immediate read after confirmation can still hit a lagging RPC node.
    await act(async () => result.current.refresh())
    expect(result.current.balanceAtoms).toBe(before)
    balances.set(mint, before - 1_000_000n)
    await advance(5_000)
    expect(result.current.balanceAtoms).toBe(before - 1_000_000n)
    expect(result.current.spendableAtoms).toBe(before - 1_000_000n)

    // Keeper settlement has no UI transaction handler to call refresh.
    balances.set(mint, before + 2_000_000n)
    await advance(5_000)
    expect(result.current.balanceUi).toBe(Number(before) / 1_000_000 + 2)
  },
)

it('refreshes wrapped SOL included in the spendable SOL balance', async () => {
  const { balances, wrapper } = setup()
  const { result } = renderHook(
    () => useWalletTokenBalance(WRAPPED_SOL_MINT, 9),
    {
      wrapper,
    },
  )
  await advance()
  expect(result.current.spendableAtoms).toBe(980_000_000n)
  balances.set(WRAPPED_SOL_MINT, 200_000_000n)
  await advance(5_000)
  expect(result.current.spendableAtoms).toBe(1_180_000_000n)
})

it('refreshes when returning to the tab between polls', async () => {
  const { balances, wrapper } = setup()
  const { result } = renderHook(() => useWalletTokenBalance(ANT, 6), {
    wrapper,
  })
  await advance(8_000)
  expect(result.current.balanceUi).toBe(10)
  balances.set(ANT, 12_000_000n)
  await act(async () => {
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(1)
  })
  expect(result.current.balanceUi).toBe(12)
})

it('stops polling and clears balances after disconnecting', async () => {
  const { fetchToken, fetchWrapped, store, wrapper } = setup()
  const { result } = renderHook(() => useWalletTokenBalance(ANT, 6), {
    wrapper,
  })
  await advance()
  await act(async () => store.setState({ wallet: { status: 'disconnected' } }))
  fetchToken.mockClear()
  fetchWrapped.mockClear()
  await advance(10_000)
  expect(result.current.balanceAtoms).toBe(0n)
  expect(fetchToken).not.toHaveBeenCalled()
  expect(fetchWrapped).not.toHaveBeenCalled()
})
