// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ActivePositionCard } from './active-position-card'
import type { Address } from '@solana/kit'
import type {
  StreamingMarketState,
  TradePositionRecord,
} from '../domain/models'
import { Side } from '@/lib/generated/twob/src/generated/types'

vi.mock('../hooks/use-end-slot-bookkeeping-snapshot', () => ({
  useEndSlotBookkeepingSnapshot: () => ({ data: null }),
}))
vi.mock('../hooks/use-position-chart', () => ({
  usePositionChart: () => ({
    points: [
      { timeMs: 1000, price: 120 },
      { timeMs: 2000, price: 121 },
    ],
    startTimeMs: 1000,
    estimatedStart: false,
    isLoading: false,
    hasError: false,
  }),
}))
const previewState = vi.hoisted(() => ({
  isError: false,
  isFetching: false,
  isLoading: false,
  refetch: vi.fn(),
}))
vi.mock('../hooks/use-close-position-preview', () => ({
  useClosePositionPreview: () => ({
    ...previewState,
    data: {
      remainingDepositAtoms: 80n,
      receivedAtoms: 19n,
      feeAtoms: 1n,
      positionRentLamports: 2_000_000n,
      baseReceiver: '11111111111111111111111111111111',
      quoteReceiver: '11111111111111111111111111111111',
      rentReceiver: '11111111111111111111111111111111',
      simulatedAtMs: Date.now(),
    },
  }),
}))
beforeEach(() => {
  previewState.isError = false
  previewState.isFetching = false
})

afterEach(cleanup)

const MARKET_ADDRESS = 'BMMWpvb3PtMCnWa3uh9ChS2UWufiLLFTV6tkrCJ6DUng' as Address
const POSITION_ADDRESS =
  'CCAd78ZgUBAFNQmCCD5z4oGuFzb8uXLw5kfnBcRvDw16' as Address

function createPosition(paused: boolean): TradePositionRecord {
  return {
    address: POSITION_ADDRESS,
    data: {
      amount: 100n,
      authority: '11111111111111111111111111111111' as Address,
      baseReceiver: '11111111111111111111111111111111' as Address,
      padding: new Uint8Array(9),
      bookkeepingSnapshot: 0n,
      bump: 255,
      discriminator: new Uint8Array(8),
      flow: 10_000_000_000n,
      id: 1,
      inactiveRefund: 0n,
      lastUpdateSlot: paused ? 5n : 0n,
      market: '11111111111111111111111111111111' as Address,
      feeBpsAtSubmission: 10,
      operator: '11111111111111111111111111111111' as Address,
      pausedAtSlot: paused ? 5n : 0n,
      payer: '11111111111111111111111111111111' as Address,
      quoteReceiver: '11111111111111111111111111111111' as Address,
      remainingSlots: paused ? 5 : 10,
      side: Side.Buy,
      slotsWithoutTradesSnapshot: 0,
      startSlot: 0n,
      swappedAmountAtSnapshot: 20n,
      withdrawnAmount: 0n,
    },
  }
}

const STREAMING_STATE: StreamingMarketState = {
  baseMint: 'So11111111111111111111111111111111111111112' as Address,
  bookkeepingBasePerQuote: 0n,
  bookkeepingLastUpdateSlot: 2,
  bookkeepingQuotePerBase: 0n,
  currentSlot: 2,
  endSlotInterval: 5,
  isPaused: false,
  marketBaseFlow: 1n,
  marketId: 1,
  marketQuoteFlow: 1n,
  minimumBaseDepositAtoms: 1n,
  minimumQuoteDepositAtoms: 1n,
  quoteMint: '11111111111111111111111111111111' as Address,
}

function renderCard({
  isControlDisabled = false,
  isResuming = false,
  paused = false,
}: {
  isControlDisabled?: boolean
  isResuming?: boolean
  paused?: boolean
} = {}) {
  const onClose = vi.fn().mockResolvedValue(true)
  const onPauseToggle = vi.fn()
  const onWithdraw = vi.fn()

  render(
    <ActivePositionCard
      baseDecimals={0}
      baseTicker="SOL"
      isCloseDisabled={isControlDisabled}
      isClosing={false}
      isControlDisabled={isControlDisabled}
      isPausing={false}
      isResuming={isResuming}
      isWithdrawing={false}
      marketAddress={MARKET_ADDRESS}
      onClose={onClose}
      onPauseToggle={onPauseToggle}
      onWithdraw={onWithdraw}
      position={createPosition(paused)}
      quoteDecimals={0}
      quoteTicker="USDC"
      streamingState={STREAMING_STATE}
    />,
  )

  return { onClose, onPauseToggle, onWithdraw }
}

describe('ActivePositionCard controls', () => {
  it('offers pause and withdraw actions for an active position', () => {
    const { onPauseToggle, onWithdraw } = renderCard()

    expect(
      screen
        .getByRole('button', { name: 'Withdraw swapped' })
        .hasAttribute('disabled'),
    ).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Pause position' }))
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw swapped' }))

    expect(onPauseToggle).toHaveBeenCalledWith(POSITION_ADDRESS)
    expect(onWithdraw).toHaveBeenCalledWith(POSITION_ADDRESS)
  })

  it('shows paused state and offers resume', () => {
    renderCard({ paused: true })

    expect(screen.getByText('Paused')).toBeTruthy()
    expect(
      screen
        .getByRole('button', {
          name: 'Resume position',
        })
        .hasAttribute('disabled'),
    ).toBe(false)
    expect(
      screen.getByRole('progressbar', { name: 'Buy position progress' }),
    ).toBeTruthy()
  })

  it('locks every card action while a position update is pending', () => {
    renderCard({
      isControlDisabled: true,
      isResuming: true,
      paused: true,
    })

    expect(
      screen
        .getByRole('button', {
          name: 'Resume position',
        })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(
      screen
        .getByRole('button', {
          name: 'Withdraw swapped',
        })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(
      screen
        .getByRole('button', {
          name: 'Close position',
        })
        .hasAttribute('disabled'),
    ).toBe(true)
  })

  it('shows the chart and details initially and can collapse them', () => {
    renderCard()
    expect(
      screen.getByRole('img', { name: /market price history/ }),
    ).toBeTruthy()
    expect(screen.getByText('Available after fee')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Collapse SOL position' }),
    )
    expect(
      screen.queryByRole('img', { name: /market price history/ }),
    ).toBeNull()
    expect(screen.getByRole('button', { name: 'Pause position' })).toBeTruthy()
  })

  it('requires a close review and keeps cancellation separate from submission', async () => {
    const { onClose } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Close position' }))
    const dialog = within(
      await screen.findByRole('dialog', { name: 'Close this stream?' }),
    )
    expect(onClose).not.toHaveBeenCalled()
    expect(
      dialog.getByText('This ends the stream. It can’t be resumed.'),
    ).toBeTruthy()
    expect(dialog.getByText('19')).toBeTruthy()
    expect(dialog.getByText('80')).toBeTruthy()
    fireEvent.click(dialog.getByRole('button', { name: 'Keep it running' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close position' }))
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Close stream',
      }),
    )
    await waitFor(() =>
      expect(onClose).toHaveBeenCalledExactlyOnceWith(POSITION_ADDRESS),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('cannot confirm a failed or refreshing preview', async () => {
    previewState.isError = true
    const { onClose } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Close position' }))
    const dialog = within(await screen.findByRole('dialog'))
    expect(
      dialog
        .getByRole('button', { name: 'Close stream' })
        .hasAttribute('disabled'),
    ).toBe(true)
    fireEvent.click(dialog.getByRole('button', { name: 'Close stream' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(dialog.getByRole('alert')).toBeTruthy()
  })

  it('keeps the review open after a rejected close', async () => {
    const { onClose } = renderCard({ paused: true })
    onClose.mockResolvedValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Close position' }))
    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getByRole('button', { name: 'Keep it paused' })).toBeTruthy()
    fireEvent.click(dialog.getByRole('button', { name: 'Close stream' }))
    await waitFor(() =>
      expect(dialog.getByRole('alert').textContent).toContain(
        'The position was not closed',
      ),
    )
  })
})
