import { describe, expect, it } from 'vitest'
import { MARKET_DEFINITIONS } from '../constants'
import { filterAndSortMarkets, parseMarketFavorites } from './market-catalog'
import type { MarketSortKey, MarketStatsById } from './market-catalog'

const defaults = {
  query: '',
  tab: 'all' as const,
  favorites: [],
  sort: { key: 'market' as const, direction: 'asc' as const },
  stats: {},
}

describe('market catalog', () => {
  it('finds markets by normalized pair, name, or mint', () => {
    for (const query of ['mAtO / uSdC', MARKET_DEFINITIONS[1].baseMint]) {
      expect(
        filterAndSortMarkets({ ...defaults, query }).map((market) => market.id),
      ).toEqual([2])
    }
    expect(
      filterAndSortMarkets({ ...defaults, query: 'Solana Beach' }).map(
        (market) => market.id,
      ),
    ).toEqual([3])
  })

  it.each(['price', 'change24h', 'volume24h'] as MarketSortKey[])(
    'sorts %s with non-finite or unknown values last',
    (key) => {
      const stats: MarketStatsById = {
        1: { price: 20, change24h: -5, volume24h: 20 },
        2: { price: 100, change24h: 0, volume24h: 100 },
        3: {
          price: Number.NaN,
          change24h: Number.NaN,
          volume24h: Number.POSITIVE_INFINITY,
        },
      }
      expect(
        filterAndSortMarkets({
          ...defaults,
          stats,
          sort: { key, direction: 'asc' },
        }).map((m) => m.id),
      ).toEqual([1, 2, 3, 4])
      expect(
        filterAndSortMarkets({
          ...defaults,
          stats,
          sort: { key, direction: 'desc' },
        }).map((m) => m.id),
      ).toEqual([2, 1, 3, 4])
    },
  )

  it('sanitizes saved favorites to unique known market ids', () => {
    expect(parseMarketFavorites('[4,2,4,99,"1",null]')).toEqual([2, 4])
    for (const value of [null, 'invalid', '{}', 'null'])
      expect(parseMarketFavorites(value)).toEqual([])
  })
})
