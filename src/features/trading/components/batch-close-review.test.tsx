// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BatchCloseReview } from './batch-close-review'
import { Side } from '@/lib/generated/twob/src/generated/types'
import type { Address } from '@solana/kit'
import type { TradePositionRecord } from '../domain/models'
const key = '11111111111111111111111111111111' as Address
const query = vi.hoisted(() => ({ isError: false, isFetching: false }))
vi.mock('@solana/react-hooks', () => ({
  useSolanaClient: () => ({}),
  useWalletSession: () => ({
    account: { address: '11111111111111111111111111111111' },
  }),
}))
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    ...query,
    isLoading: false,
    refetch: vi.fn(),
    data: [1, 2].map(() => ({
      remainingDepositAtoms: 20n,
      receivedAtoms: 10n,
      feeAtoms: 1n,
      positionRentLamports: 100n,
      baseReceiver: key,
      quoteReceiver: key,
      rentReceiver: key,
      simulatedAtMs: Date.now(),
    })),
  }),
}))
afterEach(cleanup)
beforeEach(() => {
  query.isError = false
  query.isFetching = false
})
function setup() {
  const onConfirm = vi.fn().mockResolvedValue(true),
    onDismiss = vi.fn()
  render(
    <BatchCloseReview
      positions={
        [
          { address: key, data: { side: Side.Sell } },
          {
            address: 'So11111111111111111111111111111111111111112',
            data: { side: Side.Buy },
          },
        ] as TradePositionRecord[]
      }
      marketAddress={key}
      baseTicker="SOL"
      quoteTicker="USDC"
      baseDecimals={0}
      quoteDecimals={0}
      onConfirm={onConfirm}
      onDismiss={onDismiss}
      isPending={false}
    />,
  )
  return { onConfirm, onDismiss }
}
it('shows a permanent-close warning and cancels without submission', () => {
  const callbacks = setup()
  expect(screen.getByRole('dialog', { name: 'Close 2 streams?' })).toBeTruthy()
  expect(
    screen.getByText(
      'These streams will end permanently. They can’t be resumed.',
    ),
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Keep streams' }))
  expect(callbacks.onDismiss).toHaveBeenCalledOnce()
  expect(callbacks.onConfirm).not.toHaveBeenCalled()
})
it('blocks a failed preview and keeps a rejected close review open', async () => {
  query.isError = true
  const first = setup()
  expect(
    screen
      .getByRole('button', { name: 'Close streams' })
      .hasAttribute('disabled'),
  ).toBe(true)
  expect(first.onConfirm).not.toHaveBeenCalled()
  cleanup()
  query.isError = false
  const callbacks = setup()
  callbacks.onConfirm.mockResolvedValue(false)
  fireEvent.click(screen.getByRole('button', { name: 'Close streams' }))
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('not closed'),
  )
  expect(callbacks.onDismiss).not.toHaveBeenCalled()
})
