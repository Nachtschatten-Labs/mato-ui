// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Address } from '@solana/kit'
import type { ReactNode } from 'react'
import { fetchEndSlotBookkeepingSnapshot } from '../api/twob-client'
import { useEndSlotBookkeepingSnapshot } from './use-end-slot-bookkeeping-snapshot'

vi.mock('@solana/react-hooks', () => ({
  useSolanaClient: () => ({ runtime: { rpc: {} } }),
}))
vi.mock('../api/twob-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/twob-client')>()),
  fetchEndSlotBookkeepingSnapshot: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('useEndSlotBookkeepingSnapshot', () => {
  it('loads the completed fill as soon as enabled, while keeper bookkeeping is still before the end', async () => {
    const snapshot = { slot: 110, bookkeeping: 50n, slotsWithoutTrades: 7 }
    vi.mocked(fetchEndSlotBookkeepingSnapshot).mockResolvedValue(snapshot)
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useEndSlotBookkeepingSnapshot({
          marketAddress: '11111111111111111111111111111111' as Address,
          bookkeepingLastUpdateSlot: 100,
          endSlot: 110,
          endSlotInterval: 11,
          isBuy: true,
          enabled,
        }),
      { wrapper, initialProps: { enabled: false } },
    )
    expect(fetchEndSlotBookkeepingSnapshot).not.toHaveBeenCalled()
    rerender({ enabled: true })
    await waitFor(() => expect(result.current.data).toEqual(snapshot))
    expect(fetchEndSlotBookkeepingSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        bookkeepingLastUpdateSlot: 100,
        endSlot: 110,
      }),
    )
    client.clear()
  })
})
