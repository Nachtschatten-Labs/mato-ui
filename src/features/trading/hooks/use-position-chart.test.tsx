// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchMarketUpdateRange } from '../api/market-repository'
import { usePositionChart } from './use-position-chart'
import type { ReactNode } from 'react'
import type { MarketUpdateEvent } from '@/integrations/read-api'

const rpc = vi.hoisted(() => ({ getBlockTime: vi.fn() }))
vi.mock('@solana/react-hooks', () => ({
  useSolanaClient: () => ({ runtime: { rpc } }),
}))
vi.mock('../api/market-repository', () => ({ fetchMarketUpdateRange: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function event(slot: number, price: number): MarketUpdateEvent {
  return {
    id: slot,
    signature: `tx-${slot}`,
    slot,
    base_flow: 1_000_000_000n,
    quote_flow: BigInt(price * 1_000_000),
    market_address: 'market',
    created_at: '2026-10-07T12:00:00Z',
  }
}

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

const defaults = {
  enabled: true,
  startSlot: 1000n,
  endSlot: 1010n,
  paused: false,
  marketId: 1,
}

describe('position chart end boundary', () => {
  it('freezes at the end slot, including after further live updates and clock ticks', async () => {
    rpc.getBlockTime.mockImplementation((slot: bigint) => ({
      send: async () => (slot === 1000n ? 1_791_374_400n : 1_791_374_402n),
    }))
    vi.mocked(fetchMarketUpdateRange).mockResolvedValue([
      event(1000, 120),
      event(1005, 122),
    ])
    const { result, rerender } = renderHook(
      ({ currentSlot, latestPrice }) =>
        usePositionChart({ ...defaults, currentSlot, latestPrice }),
      {
        wrapper: wrapper(),
        initialProps: {
          currentSlot: 1005,
          latestPrice: { slot: 1005, price: 122, eventTimeMs: 1 },
        },
      },
    )
    await waitFor(() =>
      expect(result.current.points.at(-1)).toEqual({ slot: 1005, price: 122 }),
    )
    rerender({
      currentSlot: 1010,
      latestPrice: { slot: 1010, price: 90, eventTimeMs: 2 },
    })
    await waitFor(() =>
      expect(result.current.endTimeMs).toBe(1_791_374_402_000),
    )
    expect(fetchMarketUpdateRange).toHaveBeenLastCalledWith({
      startSlot: 1000,
      endSlot: 1010,
      marketId: 1,
    })
    const completed = result.current.points
    expect(completed).toEqual([
      { slot: 1000, price: 120 },
      { slot: 1005, price: 122 },
      { slot: 1010, price: 122 },
    ])
    const callCount = vi.mocked(fetchMarketUpdateRange).mock.calls.length
    rerender({
      currentSlot: 1100,
      latestPrice: { slot: 1100, price: 80, eventTimeMs: 3 },
    })
    expect(result.current.points).toEqual(completed)
    expect(result.current.endSlot).toBe(1010)
    expect(fetchMarketUpdateRange).toHaveBeenCalledTimes(callCount)
  })

  it('loads a short already-ended position without relying on a full candle or current price', async () => {
    rpc.getBlockTime.mockReturnValue({ send: async () => null })
    vi.mocked(fetchMarketUpdateRange).mockResolvedValue([
      event(1000, 120),
      event(1010, 90),
    ])
    const { result } = renderHook(
      () =>
        usePositionChart({
          ...defaults,
          currentSlot: 1100,
          latestPrice: { slot: 1100, price: 80, eventTimeMs: Date.now() },
        }),
      { wrapper: wrapper() },
    )
    await waitFor(() =>
      expect(result.current.points).toEqual([
        { slot: 1000, price: 120 },
        { slot: 1010, price: 120 },
      ]),
    )
    expect(result.current.estimatedEnd).toBe(true)
  })

  it('keeps a paused position chart open after its former end slot', async () => {
    rpc.getBlockTime.mockReturnValue({ send: async () => null })
    vi.mocked(fetchMarketUpdateRange).mockResolvedValue([
      event(1000, 120),
      event(1020, 90),
    ])
    const { result } = renderHook(
      () =>
        usePositionChart({
          ...defaults,
          paused: true,
          currentSlot: 1020,
          latestPrice: null,
        }),
      { wrapper: wrapper() },
    )
    await waitFor(() =>
      expect(result.current.points.at(-1)).toEqual({ slot: 1020, price: 90 }),
    )
    expect(result.current.hasEnded).toBe(false)
  })
})
