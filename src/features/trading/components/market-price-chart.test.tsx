// @vitest-environment jsdom

import { Profiler } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MarketPriceChart } from './market-price-chart'

const chartMocks = vi.hoisted(() => {
  const candleSeries = {
    applyOptions: vi.fn(),
    setData: vi.fn(),
    update: vi.fn(),
  }
  const areaSeries = {
    applyOptions: vi.fn(),
    setData: vi.fn(),
    update: vi.fn(),
  }
  const timeScale = {
    applyOptions: vi.fn(),
    fitContent: vi.fn(),
    getVisibleLogicalRange: vi.fn(() => ({ from: 0, to: 1 })),
    setVisibleLogicalRange: vi.fn(),
    subscribeSizeChange: vi.fn(),
    subscribeVisibleLogicalRangeChange: vi.fn(),
    unsubscribeSizeChange: vi.fn(),
    unsubscribeVisibleLogicalRangeChange: vi.fn(),
  }
  const chart = {
    addSeries: vi.fn((type: string) =>
      type === 'Area' ? areaSeries : candleSeries,
    ),
    remove: vi.fn(),
    subscribeCrosshairMove: vi.fn(),
    timeScale: () => timeScale,
  }
  return {
    areaSeries,
    candleSeries,
    createChart: vi.fn(() => chart),
  }
})

vi.mock('lightweight-charts', () => ({
  AreaSeries: 'Area',
  CandlestickSeries: 'Candlestick',
  ColorType: { Solid: 'solid' },
  CrosshairMode: { Normal: 0 },
  createChart: chartMocks.createChart,
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('MarketPriceChart', () => {
  it('settles when optional overlays are omitted and still switches chart modes', () => {
    const candles = [
      {
        time: 1759276800,
        open: 140,
        high: 142,
        low: 139,
        close: 141,
        volume: 100,
      },
    ]
    let commits = 0
    const onRender = () => {
      commits += 1
      // Bound a regression explicitly so an effect loop cannot hang the suite.
      if (commits > 8) throw new Error('Chart entered a render loop')
    }
    const view = render(
      <Profiler id="chart" onRender={onRender}>
        <MarketPriceChart data={candles} displayMode="line" />
      </Profiler>,
    )

    expect(chartMocks.areaSeries.setData).toHaveBeenCalledWith([
      { time: 1759276800, value: 141 },
    ])
    expect(chartMocks.areaSeries.applyOptions).toHaveBeenLastCalledWith({
      visible: true,
    })

    view.rerender(
      <Profiler id="chart" onRender={onRender}>
        <MarketPriceChart data={candles} displayMode="candles" />
      </Profiler>,
    )

    expect(chartMocks.candleSeries.applyOptions).toHaveBeenLastCalledWith({
      visible: true,
    })
    expect(chartMocks.areaSeries.applyOptions).toHaveBeenLastCalledWith({
      visible: false,
    })
    expect(chartMocks.createChart).toHaveBeenCalledOnce()
    expect(commits).toBeLessThanOrEqual(4)
  })
})
