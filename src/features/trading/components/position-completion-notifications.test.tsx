// @vitest-environment jsdom

import { StrictMode } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { PositionCompletionNotifications } from './position-completion-notifications'
import { useEndSlotBookkeepingSnapshot } from '../hooks/use-end-slot-bookkeeping-snapshot'
import type { ComponentProps } from 'react'
import type { Address } from '@solana/kit'
import type { TradePosition } from '@/lib/generated/twob/src/generated/accounts'
import type {
  StreamingMarketState,
  TradePositionRecord,
  TradeSettlementSnapshot,
} from '../domain/models'
import { Side } from '@/lib/generated/twob/src/generated/types'

const snapshotState = vi.hoisted(() => ({
  data: null as TradeSettlementSnapshot | null,
}))
vi.mock('../hooks/use-end-slot-bookkeeping-snapshot', () => ({
  useEndSlotBookkeepingSnapshot: vi.fn(() => snapshotState),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

beforeEach(() => {
  snapshotState.data = null
  vi.clearAllMocks()
})
afterEach(cleanup)

const MARKET_ADDRESS = 'BMMWpvb3PtMCnWa3uh9ChS2UWufiLLFTV6tkrCJ6DUng' as Address
const POSITION_ADDRESS =
  'CCAd78ZgUBAFNQmCCD5z4oGuFzb8uXLw5kfnBcRvDw16' as Address
const OWNER_ADDRESS = '11111111111111111111111111111111' as Address

function createPosition(
  overrides: Partial<TradePosition> = {},
): TradePositionRecord {
  return {
    address: POSITION_ADDRESS,
    data: {
      amount: 100_500_000n,
      authority: OWNER_ADDRESS,
      baseReceiver: OWNER_ADDRESS,
      padding: new Uint8Array(9),
      bookkeepingSnapshot: 0n,
      bump: 255,
      discriminator: new Uint8Array(8),
      flow: 10_050_000_000_000_000n,
      id: 1,
      inactiveRefund: 0n,
      lastUpdateSlot: 0n,
      market: MARKET_ADDRESS,
      feeBpsAtSubmission: 10,
      operator: OWNER_ADDRESS,
      pausedAtSlot: 0n,
      payer: OWNER_ADDRESS,
      quoteReceiver: OWNER_ADDRESS,
      remainingSlots: 10,
      side: Side.Buy,
      slotsWithoutTradesSnapshot: 0,
      startSlot: 0n,
      swappedAmountAtSnapshot: 0n,
      withdrawnAmount: 0n,
      ...overrides,
    },
  }
}

const STREAMING_STATE: StreamingMarketState = {
  baseMint: 'So11111111111111111111111111111111111111112' as Address,
  bookkeepingBasePerQuote: 50_000_000_000_000_000n,
  bookkeepingLastUpdateSlot: 5,
  bookkeepingSlotsWithoutTrades: 0,
  bookkeepingQuotePerBase: 2_000_000_000_000_000n,
  currentSlot: 5,
  endSlotInterval: 5,
  isPaused: false,
  marketBaseFlow: 1n,
  marketId: 1,
  marketQuoteFlow: 1n,
  minimumBaseDepositAtoms: 1n,
  minimumQuoteDepositAtoms: 1n,
  quoteMint: OWNER_ADDRESS,
}
const FINAL_SNAPSHOT: TradeSettlementSnapshot = {
  slot: 10,
  bookkeeping: 50_000_000_000_000_000n,
  slotsWithoutTrades: 0,
}

type NotificationProps = ComponentProps<typeof PositionCompletionNotifications>

function renderNotifications(
  overrides: Partial<NotificationProps> = {},
  strictMode = false,
) {
  let props: NotificationProps = {
    baseDecimals: 9,
    baseTicker: 'SOL',
    marketAddress: MARKET_ADDRESS,
    positions: [createPosition()],
    quoteDecimals: 6,
    quoteTicker: 'USDC',
    streamingState: STREAMING_STATE,
    ...overrides,
  }
  const element = () =>
    strictMode ? (
      <StrictMode>
        <PositionCompletionNotifications {...props} />
      </StrictMode>
    ) : (
      <PositionCompletionNotifications {...props} />
    )
  const view = render(element())
  return (updates: Partial<NotificationProps> = {}) => {
    props = { ...props, ...updates }
    view.rerender(element())
  }
}

function expectResult(description: string, startSlot = 0n) {
  expect(toast.success).toHaveBeenCalledExactlyOnceWith('Position ended', {
    description,
    id: `position-ended-${POSITION_ADDRESS}:${startSlot}`,
  })
}

describe('PositionCompletionNotifications', () => {
  it('does not announce historical ended positions on load or reappearance', () => {
    snapshotState.data = FINAL_SNAPSHOT
    const positions = [createPosition()]
    const rerender = renderNotifications({
      positions,
      streamingState: { ...STREAMING_STATE, currentSlot: 10 },
    })
    rerender({ positions: [] })
    rerender({ positions })

    expect(toast.success).not.toHaveBeenCalled()
    expect(useEndSlotBookkeepingSnapshot).not.toHaveBeenCalled()
  })

  it('waits at the exact end for valid final accounting instead of live or stale results', () => {
    const rerender = renderNotifications()
    expect(useEndSlotBookkeepingSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false, endSlot: 10, isBuy: true }),
    )
    rerender({
      streamingState: {
        ...STREAMING_STATE,
        currentSlot: 10,
        bookkeepingLastUpdateSlot: 10,
      },
    })
    expect(useEndSlotBookkeepingSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true, endSlot: 10 }),
    )
    expect(toast.success).not.toHaveBeenCalled()

    snapshotState.data = { ...FINAL_SNAPSHOT, slot: 9 }
    rerender()
    expect(toast.success).not.toHaveBeenCalled()
    snapshotState.data = { ...FINAL_SNAPSHOT, slotsWithoutTrades: 11 }
    rerender()
    expect(toast.success).not.toHaveBeenCalled()

    snapshotState.data = FINAL_SNAPSHOT
    rerender()
    expectResult(
      'Swapped 100.5 USDC into 0.5025 SOL (before fees). Average price: 200 USDC/SOL.',
    )
  })

  it('formats sell amounts with different token decimals and keeps the quote/base price', () => {
    const rerender = renderNotifications({
      positions: [
        createPosition({
          side: Side.Sell,
          amount: 502_500_000n,
          flow: 50_250_000_000_000_000n,
        }),
      ],
    })
    snapshotState.data = {
      ...FINAL_SNAPSHOT,
      bookkeeping: 2_000_000_000_000_000n,
    }
    rerender({ streamingState: { ...STREAMING_STATE, currentSlot: 10 } })

    expect(useEndSlotBookkeepingSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ isBuy: false }),
    )
    expectResult(
      'Swapped 0.5025 SOL into 100.5 USDC (before fees). Average price: 200 USDC/SOL.',
    )
  })

  it('includes earlier withdrawals in total output and excludes refunded input', () => {
    const rerender = renderNotifications({
      positions: [
        createPosition({
          amount: 100_000_000n,
          flow: 10_000_000_000_000_000n,
          lastUpdateSlot: 4n,
          remainingSlots: 6,
          inactiveRefund: 10_000_000n,
          bookkeepingSnapshot: 10_000_000_000_000_000n,
          slotsWithoutTradesSnapshot: 1,
          swappedAmountAtSnapshot: 100_000_000n,
          withdrawnAmount: 100_000_000n,
        }),
      ],
    })
    snapshotState.data = {
      slot: 10,
      bookkeeping: 40_000_000_000_000_000n,
      slotsWithoutTrades: 2,
    }
    rerender({ streamingState: { ...STREAMING_STATE, currentSlot: 20 } })

    expectResult(
      'Swapped 80 USDC into 0.4 SOL (before fees). Average price: 200 USDC/SOL.',
    )
  })

  it('does not duplicate notifications across StrictMode, rerenders, or observer remounts', () => {
    const positions = [createPosition()]
    const rerender = renderNotifications({ positions }, true)
    snapshotState.data = FINAL_SNAPSHOT
    rerender({ streamingState: { ...STREAMING_STATE, currentSlot: 10 } })
    rerender()
    rerender({ positions: [] })
    rerender({ positions })

    expect(toast.success).toHaveBeenCalledTimes(1)
  })

  it('announces a short position first observed after it ends', () => {
    const rerender = renderNotifications({ positions: [] }, true)
    snapshotState.data = FINAL_SNAPSHOT
    rerender({
      positions: [createPosition()],
      streamingState: { ...STREAMING_STATE, currentSlot: 11 },
    })

    expectResult(
      'Swapped 100.5 USDC into 0.5025 SOL (before fees). Average price: 200 USDC/SOL.',
    )
  })

  it('keeps an observed completion until final accounting arrives after account closure', () => {
    const rerender = renderNotifications()
    rerender({ streamingState: { ...STREAMING_STATE, currentSlot: 10 } })
    rerender({ positions: [] })
    expect(toast.success).not.toHaveBeenCalled()

    snapshotState.data = FINAL_SNAPSHOT
    rerender()
    rerender()

    expectResult(
      'Swapped 100.5 USDC into 0.5025 SOL (before fees). Average price: 200 USDC/SOL.',
    )
  })

  it('does not announce a missing live position at its former scheduled end', () => {
    const rerender = renderNotifications()
    rerender({ positions: [] })
    snapshotState.data = FINAL_SNAPSHOT
    rerender({ streamingState: { ...STREAMING_STATE, currentSlot: 10 } })

    expect(toast.success).not.toHaveBeenCalled()
  })

  it('waits through a pause and announces completion at the resumed end slot', () => {
    const paused = createPosition({
      lastUpdateSlot: 5n,
      remainingSlots: 5,
      pausedAtSlot: 5n,
      bookkeepingSnapshot: 25_000_000_000_000_000n,
      swappedAmountAtSnapshot: 251_250_000n,
    })
    snapshotState.data = FINAL_SNAPSHOT
    const rerender = renderNotifications({
      positions: [paused],
      streamingState: { ...STREAMING_STATE, currentSlot: 20 },
    })
    expect(useEndSlotBookkeepingSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    )
    expect(toast.success).not.toHaveBeenCalled()

    rerender({
      positions: [
        {
          ...paused,
          data: { ...paused.data, pausedAtSlot: 0n, lastUpdateSlot: 20n },
        },
      ],
    })
    expect(toast.success).not.toHaveBeenCalled()
    rerender({ streamingState: { ...STREAMING_STATE, currentSlot: 25 } })
    expect(toast.success).not.toHaveBeenCalled()

    snapshotState.data = { ...FINAL_SNAPSHOT, slot: 25 }
    rerender()
    expectResult(
      'Swapped 100.5 USDC into 0.5025 SOL (before fees). Average price: 200 USDC/SOL.',
    )
  })

  it('reports confirmed zero fills without inventing an average price', () => {
    const rerender = renderNotifications()
    snapshotState.data = {
      slot: 10,
      bookkeeping: 0n,
      slotsWithoutTrades: 10,
    }
    rerender({ streamingState: { ...STREAMING_STATE, currentSlot: 10 } })

    expectResult(
      'Swapped 0 USDC into 0 SOL (before fees). Average price unavailable.',
    )
  })
})
