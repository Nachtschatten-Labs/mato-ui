import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMarketDefinition } from '../constants'
import {
  fetchClosedPositionEvents,
  fetchMarketCandles,
  fetchMarketConfig,
  fetchMarketPrice,
  fetchMarketUpdatesPage,
  subscribeToMarketPriceStream,
} from './market-repository'
const market = getMarketDefinition(1)
const origin = 'https://read.example.com'
const mockedFetch = vi.fn<typeof fetch>()
beforeEach(() => {
  vi.stubEnv('VITE_READ_API_URL', origin)
  vi.stubGlobal('fetch', mockedFetch)
  mockedFetch.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
function respond(body: unknown, status = 200) {
  mockedFetch.mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status }),
  )
}
const price = {
  market_address: market.address,
  slot: 453870292,
  price: 150,
  event_time: '2026-10-06T12:00:00Z',
}
describe('address-based mainnet data API', () => {
  it('requests prices for the deployed address', async () => {
    respond(price)
    expect(await fetchMarketPrice({ marketId: 1 })).toMatchObject({
      price: 150,
      slot: price.slot,
    })
    expect(mockedFetch.mock.calls[0][0]).toBe(
      `${origin}/v1/markets/${market.address}/price`,
    )
  })
  it('represents a market without its first quote as empty', async () => {
    respond({ error: 'No price available' }, 404)
    expect(await fetchMarketPrice({ marketId: 1 })).toEqual({
      price: null,
      slot: null,
      eventTimeMs: null,
    })
  })
  it('rejects prices attributed to another market', async () => {
    respond({ ...price, market_address: market.baseMint })
    await expect(fetchMarketPrice({ marketId: 1 })).rejects.toThrow(
      'different market',
    )
  })
  it('verifies configured mints and decimals', async () => {
    respond({
      market_address: market.address,
      base_mint: market.baseMint,
      quote_mint: market.quoteMint,
      base_decimals: 6,
      quote_decimals: 6,
    })
    await expect(fetchMarketConfig(1)).rejects.toThrow('does not match')
  })
  it('isolates update rows as well as their envelope', async () => {
    respond({
      market_address: market.address,
      items: [{ market_address: market.baseMint }],
    })
    await expect(
      fetchMarketUpdatesPage({ marketId: 1, limit: 5 }),
    ).rejects.toThrow('different market')
  })
  it('loads candles by market address', async () => {
    respond({
      market_address: market.address,
      items: [{ time: 1791288000, open: 140, high: 150, low: 130, close: 145 }],
    })
    const candles = await fetchMarketCandles({
      marketId: 1,
      interval: '1m',
      from: new Date(0),
      to: new Date(),
    })
    expect(candles).toHaveLength(1)
    expect(String(mockedFetch.mock.calls[0][0])).toContain(
      `/markets/${market.address}/candles?`,
    )
  })
  it('filters closed positions by address and before_slot', async () => {
    respond({
      authority: market.baseMint,
      market_address: market.address,
      items: [
        {
          market_address: market.address,
          signature: 'tx',
          event_index: 0,
          slot: 10,
          start_slot: 1,
          end_slot: 10,
          deposit_amount: '100000000',
          swapped_amount: '200000000',
          remaining_amount: '0',
          fee_amount: '1',
          is_buy: true,
          event_time: price.event_time,
        },
      ],
    })
    const [closed] = await fetchClosedPositionEvents({
      positionAuthority: market.baseMint,
      marketId: 1,
      beforeSlot: 20,
    })
    expect(closed).toMatchObject({
      market_address: market.address,
      deposit_amount: 100000000n,
      is_buy: 1,
    })
    const url = new URL(String(mockedFetch.mock.calls[0][0]))
    expect(url.searchParams.get('market_address')).toBe(market.address)
    expect(url.searchParams.get('before_slot')).toBe('20')
    expect(url.searchParams.has('market_id')).toBe(false)
  })
  it('rejects another authority in closed history', async () => {
    respond({
      authority: market.quoteMint,
      market_address: market.address,
      items: [],
    })
    await expect(
      fetchClosedPositionEvents({
        positionAuthority: market.baseMint,
        marketId: 1,
      }),
    ).rejects.toThrow('different authority')
  })
  it('validates streamed market addresses before updating prices', () => {
    let listener: (event: { data: string }) => void = () => {}
    class Stream {
      constructor(readonly url: string) {}
      addEventListener(_name: string, cb: typeof listener) {
        listener = cb
      }
    }
    vi.stubGlobal('EventSource', Stream)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const update = vi.fn()
    const stream = subscribeToMarketPriceStream({
      marketId: 1,
      onPriceUpdate: update,
    })
    expect(stream.url).toBe(`${origin}/v1/markets/${market.address}/stream`)
    listener({
      data: JSON.stringify({ ...price, market_address: market.baseMint }),
    })
    expect(update).not.toHaveBeenCalled()
    listener({ data: JSON.stringify(price) })
    expect(update).toHaveBeenCalledExactlyOnceWith({
      price: 150,
      slot: price.slot,
      eventTimeMs: Date.parse(price.event_time),
    })
  })
})
