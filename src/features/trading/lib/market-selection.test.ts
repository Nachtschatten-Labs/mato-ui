import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MARKET_ID,
  MARKET_DEFINITIONS,
  getMarketDefinition,
  parseMarketSearch,
} from '../constants'
import { findMarketAddress } from './pdas'

describe('market selection', () => {
  it.each(MARKET_DEFINITIONS)(
    'derives the mainnet $baseSymbol/USDC market address',
    async (market) => {
      expect(await findMarketAddress(market)).toBe(market.address)
      expect(market.quoteMint).toBe(
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      )
      expect(() => getMarketDefinition(2)).toThrow('Unsupported market')
    },
  )
  it.each([{ market: 0 }, { market: '0' }, new URLSearchParams('market=0')])(
    'accepts ANT market ID zero from %o',
    (search) => {
      expect(parseMarketSearch(search)).toEqual({ market: 0 })
    },
  )
  it.each([{ market: 1 }, { market: '1' }, new URLSearchParams('market=1')])(
    'accepts the deployed market from %o',
    (search) => {
      expect(parseMarketSearch(search)).toEqual({ market: 1 })
    },
  )
  it.each([
    undefined,
    null,
    {},
    { market: '' },
    { market: '2.0' },
    { market: '1e0' },
    { market: 2.5 },
    { market: -1 },
    { market: 5 },
    { market: 2 },
    { market: 3 },
    { market: 4 },
    { market: ['1', '2'] },
    new URLSearchParams('market=1&market=2'),
  ])('falls back to the default for invalid search input %o', (search) => {
    expect(parseMarketSearch(search)).toEqual({ market: DEFAULT_MARKET_ID })
  })
})
