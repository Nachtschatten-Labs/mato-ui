// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SLOT_DURATION_MS } from '../constants'
import { useClosedPositionTimes } from './use-closed-position-times'
import type { ReactNode } from 'react'
import type { ClosePositionEvent } from '@/integrations/read-api'

const rpc = vi.hoisted(() => ({ getBlockTime: vi.fn() }))
vi.mock('@solana/react-hooks', () => ({
  useSolanaClient: () => ({ runtime: { rpc } }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

const event: ClosePositionEvent = {
  id: 1,
  signature: 'close-tx',
  slot: 1200,
  start_slot: 1000,
  end_slot: 1100,
  created_at: '2026-10-07T12:00:00Z',
  market_address: 'market',
  position_authority: 'wallet',
  is_buy: 1,
  deposit_amount: 1_000_000n,
  remaining_amount: 0n,
  swapped_amount: 10_000n,
  fee_amount: 10n,
}

describe('useClosedPositionTimes', () => {
  it('uses the actual trading end block time when settlement happens later', async () => {
    rpc.getBlockTime.mockImplementation((slot: bigint) => ({
      send: async () => (slot === 1000n ? 1_791_374_300n : 1_791_374_350n),
    }))
    const { result } = renderHook(() => useClosedPositionTimes(event), {
      wrapper: wrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current).toEqual({
      startTimeMs: 1_791_374_300_000,
      endTimeMs: 1_791_374_350_000,
      estimatedStart: false,
      estimatedEnd: false,
      isLoading: false,
    })
    expect(rpc.getBlockTime.mock.calls.map(([slot]) => slot)).toEqual([
      1000n,
      1100n,
    ])
  })

  it('clamps an early close to its transaction slot and uses its timestamp when RPC is unavailable', async () => {
    rpc.getBlockTime.mockReturnValue({ send: async () => null })
    const earlyClose = { ...event, slot: 1050 }
    const { result } = renderHook(() => useClosedPositionTimes(earlyClose), {
      wrapper: wrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.endTimeMs).toBe(Date.parse(event.created_at))
    expect(result.current.estimatedEnd).toBe(false)
    expect(result.current.startTimeMs).toBe(
      Date.parse(event.created_at) - 50 * SLOT_DURATION_MS,
    )
    expect(result.current.estimatedStart).toBe(true)
    expect(rpc.getBlockTime).toHaveBeenCalledWith(1050n)
    expect(rpc.getBlockTime).not.toHaveBeenCalledWith(1100n)
  })

  it('anchors failed-RPC estimates to the close event rather than the current time', async () => {
    rpc.getBlockTime.mockReturnValue({
      send: async () => {
        throw new Error('Block unavailable')
      },
    })
    const { result } = renderHook(() => useClosedPositionTimes(event), {
      wrapper: wrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.startTimeMs).toBe(
      Date.parse(event.created_at) - 200 * SLOT_DURATION_MS,
    )
    expect(result.current.endTimeMs).toBe(
      Date.parse(event.created_at) - 100 * SLOT_DURATION_MS,
    )
    expect(result.current.estimatedStart).toBe(true)
    expect(result.current.estimatedEnd).toBe(true)
  })

  it('does not give a pre-start cancellation a future start date', async () => {
    rpc.getBlockTime.mockReturnValue({ send: async () => null })
    const { result } = renderHook(
      () => useClosedPositionTimes({ ...event, slot: 900 }),
      { wrapper: wrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.startTimeMs).toBeNull()
    expect(result.current.estimatedStart).toBe(false)
    expect(result.current.endTimeMs).toBe(Date.parse(event.created_at))
    expect(rpc.getBlockTime.mock.calls.map(([slot]) => slot)).toEqual([900n])
  })

  it('leaves missing boundary slots unavailable instead of substituting the close time', () => {
    const { result } = renderHook(
      () =>
        useClosedPositionTimes({ ...event, start_slot: null, end_slot: null }),
      { wrapper: wrapper() },
    )

    expect(result.current).toEqual({
      startTimeMs: null,
      endTimeMs: null,
      estimatedStart: false,
      estimatedEnd: false,
      isLoading: false,
    })
    expect(rpc.getBlockTime).not.toHaveBeenCalled()
  })

  it('leaves dates unavailable when both RPC and the close timestamp are unavailable', async () => {
    rpc.getBlockTime.mockReturnValue({ send: async () => null })
    const { result } = renderHook(
      () => useClosedPositionTimes({ ...event, created_at: 'invalid' }),
      { wrapper: wrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.startTimeMs).toBeNull()
    expect(result.current.endTimeMs).toBeNull()
    expect(result.current.estimatedStart).toBe(false)
    expect(result.current.estimatedEnd).toBe(false)
  })

  it("does not reuse one close event's estimate for another event sharing its slots", async () => {
    rpc.getBlockTime.mockReturnValue({ send: async () => null })
    const { result, rerender } = renderHook(
      (closeEvent) => useClosedPositionTimes(closeEvent),
      { initialProps: event, wrapper: wrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const firstEnd = result.current.endTimeMs!
    rerender({ ...event, created_at: '2026-10-07T12:01:00Z' })
    expect(result.current.endTimeMs).toBe(firstEnd + 60_000)
    expect(rpc.getBlockTime).toHaveBeenCalledTimes(2)
  })
})
