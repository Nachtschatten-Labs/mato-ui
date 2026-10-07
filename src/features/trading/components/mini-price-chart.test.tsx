import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildMiniPriceChartGeometry, MiniPriceChart } from './mini-price-chart'

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

  it('keeps tiny fill differences close together with distinct fourth-decimal labels', () => {
    const points = [
      { slot: 1000, price: 116.2176 },
      { slot: 1020, price: 116.2176 },
    ]
    const averagePrice = 116.21760001
    const geometry = buildMiniPriceChartGeometry(points, 240, 60, averagePrice)!
    const pathY = Number(geometry.path.split(' ')[2])
    expect(geometry.max - geometry.min).toBeCloseTo(0.0002, 10)
    expect(Math.abs(geometry.averageY! - pathY)).toBeLessThan(0.01)

    const markup = renderToStaticMarkup(
      <MiniPriceChart points={points} averagePrice={averagePrice} />,
    )
    for (const label of ['116.2177', '116.2176', '116.2175']) {
      expect(markup).toContain(`<span>${label}</span>`)
    }
  })

  it.each([null, 116.2176])(
    'uses the same minimum scale for a constant price (average=%s)',
    (averagePrice) => {
      const geometry = buildMiniPriceChartGeometry(
        [
          { slot: 1000, price: 116.2176 },
          { slot: 1020, price: 116.2176 },
        ],
        240,
        60,
        averagePrice,
      )!
      expect(geometry.min).toBeCloseTo(116.2175, 10)
      expect(geometry.max).toBeCloseTo(116.2177, 10)
      expect(geometry.path).toBe('M 0.00 30.00 H 240.00 V 30.00')
      if (averagePrice !== null) expect(geometry.averageY).toBeCloseTo(30)
    },
  )

  it('retains padding around larger moves and an average outside the price path', () => {
    const geometry = buildMiniPriceChartGeometry(
      [
        { slot: 1000, price: 100 },
        { slot: 1020, price: 120 },
      ],
      240,
      60,
      130,
    )!
    expect(geometry.min).toBeCloseTo(97.6)
    expect(geometry.max).toBeCloseTo(132.4)
    expect(geometry.averageY).toBeGreaterThan(6)
    expect(geometry.averageY).toBeLessThan(54)
  })

  it('keeps the minimum scale nonnegative for prices below one tick', () => {
    const points = [
      { slot: 1000, price: 0.00001 },
      { slot: 1020, price: 0.00001 },
    ]
    const geometry = buildMiniPriceChartGeometry(points, 240, 60, null)!
    expect(geometry.min).toBe(0)
    expect(geometry.max).toBe(0.0002)
    const markup = renderToStaticMarkup(
      <MiniPriceChart points={points} averagePrice={null} />,
    )
    for (const label of ['0.0002', '0.0001', '0']) {
      expect(markup).toContain(`<span>${label}</span>`)
    }
  })
})
