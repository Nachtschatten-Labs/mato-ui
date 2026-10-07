// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchClosedPositionMiniChart } from '../api/market-repository'
import { useClosedPositionTimes } from '../hooks/use-closed-position-times'
import { ClosedPositionsList } from './closed-positions-list'
import type { ClosePositionEvent } from '@/integrations/read-api'

const eventsQuery = vi.hoisted(() => ({
  data: [] as ClosePositionEvent[],
  isPending: false,
  error: null as Error | null,
}))
const times = vi.hoisted(() => ({
  startTimeMs: Date.parse('2026-10-07T08:12:37Z') as number | null,
  endTimeMs: Date.parse('2026-10-07T12:34:56Z') as number | null,
  estimatedStart: false,
  estimatedEnd: false,
  isLoading: false,
}))

vi.mock('../hooks/use-closed-position-events', () => ({
  useClosedPositionEvents: () => eventsQuery,
}))
vi.mock('../hooks/use-closed-position-times', () => ({
  useClosedPositionTimes: vi.fn(() => times),
}))
vi.mock('../api/market-repository', () => ({
  fetchClosedPositionMiniChart: vi.fn(),
}))

const buyEvent: ClosePositionEvent = {
  id: 1,
  signature: 'buy-transaction',
  slot: 1200,
  start_slot: 1000,
  end_slot: 1100,
  created_at: '2026-10-07T12:34:56Z',
  market_address: 'market',
  position_authority: 'wallet',
  is_buy: 1,
  deposit_amount: 200_000_000n,
  remaining_amount: 50_000_000n,
  swapped_amount: 1_000_000_000n,
  fee_amount: 1_000_000n,
}
const sellEvent: ClosePositionEvent = {
  ...buyEvent,
  id: 2,
  signature: 'sell-transaction',
  is_buy: 0,
  deposit_amount: 2_000_000_000n,
  remaining_amount: 500_000_000n,
  swapped_amount: 225_000_000n,
  fee_amount: 225_000n,
}

beforeEach(() => {
  vi.clearAllMocks()
  eventsQuery.data = [buyEvent]
  eventsQuery.isPending = false
  eventsQuery.error = null
  times.startTimeMs = Date.parse('2026-10-07T08:12:37Z')
  times.endTimeMs = Date.parse('2026-10-07T12:34:56Z')
  times.estimatedStart = false
  times.estimatedEnd = false
  times.isLoading = false
  vi.mocked(fetchClosedPositionMiniChart).mockResolvedValue([
    { slot: 1000, price: 148 },
    { slot: 1100, price: 152 },
  ])
})

afterEach(cleanup)

function renderList(priceHistoryAvailable = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <ClosedPositionsList
        baseDecimals={9}
        baseTicker="SOL"
        marketId={1}
        positionAuthority="wallet"
        priceHistoryAvailable={priceHistoryAvailable}
        quoteDecimals={6}
        quoteTicker="USDC"
      />
    </QueryClientProvider>,
  )
}

function detailValue(label: string) {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling
    ?.textContent
}

describe('ClosedPositionsList', () => {
  it('shows aligned asset, directional size, and gross average-fill columns for both sides', () => {
    eventsQuery.data = [buyEvent, sellEvent]
    renderList()

    const table = screen.getByRole('table', { name: 'Closed positions' })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Asset', 'Size', 'Avg. fill'])
    const buyRow = screen
      .getByRole('button', { name: 'Expand Buy SOL position' })
      .closest('tr')!
    const sellRow = screen
      .getByRole('button', { name: 'Expand Sell SOL position' })
      .closest('tr')!
    const buyCells = within(buyRow).getAllByRole('cell')
    const sellCells = within(sellRow).getAllByRole('cell')

    expect(buyCells[0].textContent).toContain('SOLBuy')
    expect(buyCells[1].textContent).toBe('From 150 USDC→To 0.999 SOL')
    expect(sellCells[0].textContent).toContain('SOLSell')
    expect(sellCells[1].textContent).toBe('From 1.5 SOL→To 224.775 USDC')
    expect(buyCells[2].textContent).toBe('150USDC/SOL')
    expect(sellCells[2].textContent).toBe('150USDC/SOL')
    expect(fetchClosedPositionMiniChart).not.toHaveBeenCalled()
    expect(useClosedPositionTimes).not.toHaveBeenCalled()
    expect(screen.queryByText('Fee paid')).toBeNull()
    expect(
      screen.queryByRole('group', { name: 'SOL/USDC price movement' }),
    ).toBeNull()
  })

  it.each([
    {
      event: buyEvent,
      side: 'Buy',
      fee: '0.001 SOL',
      refund: 'Refunded 50 USDC',
    },
    {
      event: sellEvent,
      side: 'Sell',
      fee: '0.225 USDC',
      refund: 'Refunded 0.5 SOL',
    },
  ])(
    'shows the $side fee in the output token when expanded',
    async ({ event, side, fee, refund }) => {
      eventsQuery.data = [event]
      renderList()
      fireEvent.click(
        screen.getByRole('button', { name: `Expand ${side} SOL position` }),
      )

      expect(detailValue('Fee paid')).toBe(fee)
      expect(screen.getByText(refund)).toBeTruthy()
      expect(
        screen
          .getByRole('link', { name: 'View transaction' })
          .getAttribute('href'),
      ).toContain(event.signature)
      await waitFor(() => expect(screen.getByText('Price path')).toBeTruthy())
    },
  )

  it('loads price movement only when expanded and reuses the chart on reopening', async () => {
    renderList()
    const expand = screen.getByRole('button', {
      name: 'Expand Buy SOL position',
    })
    expect(expand.getAttribute('aria-expanded')).toBe('false')
    expect(expand.getAttribute('type')).toBe('button')
    expand.focus()
    expect(document.activeElement).toBe(expand)
    // Native buttons support both keyboard and pointer activation; their click
    // bubbles to the row so the disclosure changes exactly once.
    fireEvent.click(expand)

    const collapse = screen.getByRole('button', {
      name: 'Collapse Buy SOL position',
    })
    expect(collapse.getAttribute('aria-expanded')).toBe('true')
    const controlledId = collapse.getAttribute('aria-controls')!
    expect(document.getElementById(controlledId)).toBeTruthy()
    expect(
      within(document.getElementById(controlledId)!).getByText('Fee paid'),
    ).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Price path')).toBeTruthy())
    expect(fetchClosedPositionMiniChart).toHaveBeenCalledTimes(1)
    expect(fetchClosedPositionMiniChart).toHaveBeenCalledWith({
      marketId: 1,
      startSlot: 1000,
      endSlot: 1100,
    })

    fireEvent.click(collapse)
    expect(document.getElementById(controlledId)).toBeNull()
    expect(screen.queryByText('Price path')).toBeNull()
    expect(screen.queryByText('Started', { exact: true })).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Buy SOL position' }),
    )
    expect(screen.getByText('Price path')).toBeTruthy()
    expect(fetchClosedPositionMiniChart).toHaveBeenCalledTimes(1)
  })

  it('formats start and end dates to the minute, including estimated times', () => {
    times.estimatedStart = true
    renderList(false)
    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Buy SOL position' }),
    )
    const options = {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    } as const
    const expectedStart = new Date(times.startTimeMs!).toLocaleString(
      undefined,
      options,
    )
    const expectedEnd = new Date(times.endTimeMs!).toLocaleString(
      undefined,
      options,
    )

    expect(detailValue('Started')).toBe(`≈ ${expectedStart}`)
    expect(detailValue('Ended')).toBe(expectedEnd)
    expect(detailValue('Started')).not.toMatch(/\d{1,2}:\d{2}:\d{2}/)
    expect(detailValue('Ended')).not.toMatch(/\d{1,2}:\d{2}:\d{2}/)
    expect(screen.queryByText('Duration')).toBeNull()
  })

  it('shows unavailable dates and history when boundary data is absent', () => {
    eventsQuery.data = [{ ...buyEvent, start_slot: null, end_slot: null }]
    times.startTimeMs = null
    times.endTimeMs = null
    renderList()
    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Buy SOL position' }),
    )

    expect(detailValue('Started')).toBe('Unavailable')
    expect(detailValue('Ended')).toBe('Unavailable')
    expect(screen.getByRole('status').textContent).toBe(
      'Price history is unavailable.',
    )
    expect(fetchClosedPositionMiniChart).not.toHaveBeenCalled()
  })

  it('does not fetch price history for markets without history support', () => {
    renderList(false)
    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Buy SOL position' }),
    )
    expect(screen.getByRole('status').textContent).toBe(
      'Price history is unavailable.',
    )
    expect(fetchClosedPositionMiniChart).not.toHaveBeenCalled()
  })

  it.each(['empty', 'failed'] as const)(
    'keeps details usable when price history is %s',
    async (state) => {
      if (state === 'empty')
        vi.mocked(fetchClosedPositionMiniChart).mockResolvedValue([])
      else
        vi.mocked(fetchClosedPositionMiniChart).mockRejectedValue(
          new Error('History offline'),
        )
      renderList()
      fireEvent.click(
        screen.getByRole('button', { name: 'Expand Buy SOL position' }),
      )

      await waitFor(() =>
        expect(screen.getByRole('status').textContent).toBe(
          'Price history is unavailable.',
        ),
      )
      expect(detailValue('Fee paid')).toBe('0.001 SOL')
      expect(
        screen.getByRole('link', { name: 'View transaction' }),
      ).toBeTruthy()
      expect(screen.queryByText('Price path')).toBeNull()
    },
  )

  it('limits an early-close chart to its close slot', async () => {
    eventsQuery.data = [{ ...buyEvent, slot: 1050 }]
    renderList()
    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Buy SOL position' }),
    )

    await waitFor(() =>
      expect(fetchClosedPositionMiniChart).toHaveBeenCalledWith({
        marketId: 1,
        startSlot: 1000,
        endSlot: 1050,
      }),
    )
  })

  it('does not load a future chart for a position canceled before its start', () => {
    eventsQuery.data = [{ ...buyEvent, slot: 900 }]
    renderList()
    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Buy SOL position' }),
    )

    expect(screen.getByRole('status').textContent).toBe(
      'Price history is unavailable.',
    )
    expect(fetchClosedPositionMiniChart).not.toHaveBeenCalled()
  })

  it('paginates collapsed rows without fetching their charts', () => {
    eventsQuery.data = Array.from({ length: 11 }, (_, index) => ({
      ...buyEvent,
      id: index + 1,
    }))
    renderList()
    expect(
      screen.getAllByRole('button', { name: 'Expand Buy SOL position' }),
    ).toHaveLength(10)
    expect(screen.getByText('1-10 of 11 positions')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))

    expect(
      screen.getAllByRole('button', { name: 'Expand Buy SOL position' }),
    ).toHaveLength(1)
    expect(screen.getByText('11-11 of 11 positions')).toBeTruthy()
    expect(fetchClosedPositionMiniChart).not.toHaveBeenCalled()
  })

  it('reports an events query failure without claiming there are no closed positions', () => {
    eventsQuery.data = []
    eventsQuery.error = new Error('Unable to load closed positions')
    renderList()

    expect(screen.getByRole('alert').textContent).toBe(
      'Unable to load closed positions',
    )
    expect(screen.queryByText('No closed positions yet.')).toBeNull()
  })
})
