// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useClosePosition } from './use-close-position'
import { TransactionConfirmationUnknownError } from '../lib/transaction-confirmation'
import type { Address } from '@solana/kit'

const mocks = vi.hoisted(() => ({
  sendClosePosition: vi.fn(),
  sendClosePositions: vi.fn(),
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
  client: {},
  session: { account: { address: 'owner' } },
  sender: { send: vi.fn(), reset: vi.fn() },
}))
vi.mock('../api/twob-client', () => ({
  sendClosePosition: mocks.sendClosePosition,
  sendClosePositions: mocks.sendClosePositions,
}))
vi.mock('@solana/react-hooks', () => ({
  useSolanaClient: () => mocks.client,
  useWalletSession: () => mocks.session,
  useSendTransaction: () => mocks.sender,
}))
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}))

describe('close position feedback', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each(['single', 'batch'] as const)(
    'retains the %s close signature without claiming success or failure',
    async (mode) => {
      const error = new TransactionConfirmationUnknownError(
        'submitted-signature',
      )
      mocks.sendClosePosition.mockRejectedValue(error)
      mocks.sendClosePositions.mockRejectedValue(error)
      const { result } = renderHook(() => useClosePosition())
      await act(async () => {
        const success =
          mode === 'single'
            ? await result.current.closePosition({
                marketAddress: 'market' as Address,
                tradePositionAddress: 'position' as Address,
              })
            : await result.current.closePositions({
                marketAddress: 'market' as Address,
                tradePositionAddresses: ['position' as Address],
              })
        expect(success).toBe(false)
      })
      expect(result.current.status).toBe('unconfirmed')
      expect(result.current.signature).toBe('submitted-signature')
      expect(result.current.error).toBe(error.message)
      expect(result.current.closedCount).toBe(0)
      expect(result.current.isClosing).toBe(false)
      expect(
        mocks.sendClosePosition.mock.calls.length +
          mocks.sendClosePositions.mock.calls.length,
      ).toBe(1)
      act(() => result.current.reset())
      expect(result.current.status).toBe('idle')
      expect(result.current.signature).toBeNull()
    },
  )

  it('still reports an actual transaction failure', async () => {
    mocks.sendClosePosition.mockRejectedValue(new Error('Insufficient funds'))
    const { result } = renderHook(() => useClosePosition())
    await act(async () => {
      await result.current.closePosition({
        marketAddress: 'market' as Address,
        tradePositionAddress: 'position' as Address,
      })
    })
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('Insufficient funds')
    expect(result.current.signature).toBeNull()
  })
})
