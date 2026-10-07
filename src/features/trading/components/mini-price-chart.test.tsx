import { describe, expect, it } from 'vitest'
import { buildMiniPriceChartGeometry } from './mini-price-chart'

describe('closed-position chart geometry', () => {
  it('places changes at their actual slot and holds the old price until then', () => {
    const geometry = buildMiniPriceChartGeometry(
      [
        { slot: 1000, price: 100 },
        { slot: 1002, price: 120 },
        { slot: 1020, price: 120 },
      ],
      200,
      60,
      110,
    )!

    expect(geometry.path).toMatch(
      /^M 0\.00 [\d.]+ H 20\.00 V [\d.]+ H 200\.00 V [\d.]+$/,
    )
    expect(geometry.averageY).toBeCloseTo(30)
  })
})
