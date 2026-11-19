import { describe, expect, it } from 'vitest'
import { MARKET_DEFINITIONS } from '../constants'
import { filterAndSortMarkets, parseMarketFavorites } from './market-catalog'
const defaults = {
  query: '',
  tab: 'all' as const,
  favorites: [],
  sort: { key: 'market' as const, direction: 'asc' as const },
  stats: {},
}
describe('mainnet market catalog', () => {
  it.each(MARKET_DEFINITIONS)(
    'finds $baseSymbol by pair, name, or mint',
    (market) => {
      for (const query of [
        `${market.baseSymbol.toLowerCase()} / uSdC`,
        market.name,
        market.baseMint,
      ])
        expect(
          filterAndSortMarkets({ ...defaults, query }).map((m) => m.id),
        ).toEqual([market.id])
      expect(filterAndSortMarkets({ ...defaults, query: 'MATO' })).toEqual([])
    },
  )
  it('discards favorites for markets absent from mainnet', () => {
    expect(parseMarketFavorites('[4,2,4,1,0,1,0,99,"0","1",null]')).toEqual([
      1, 0,
    ])
    for (const value of [null, 'invalid', '{}', 'null'])
      expect(parseMarketFavorites(value)).toEqual([])
  })
})
