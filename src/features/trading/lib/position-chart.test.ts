import { describe, expect, it } from 'vitest'
import {
  buildPositionChartPoints,
  formatStreamDuration,
} from './position-chart'

describe('position reference chart', () => {
  const candles = [0, 60, 120].map((time) => ({
    time,
    close: 100 + time,
    open: 100,
    high: 250,
    low: 100,
    volume: 0,
  }))
  it('starts at the position time, places closes at the end of the candle, and excludes future data', () => {
    expect(buildPositionChartPoints(candles, 90_000, 150_000, null)).toEqual([
      { timeMs: 120_000, price: 160 },
    ])
  })
  it('uses live price timestamps and does not invent history or mix Solana slots into the time axis', () => {
    expect(
      buildPositionChartPoints([], 90_000, 150_000, {
        price: 105,
        eventTimeMs: 130_000,
        slot: 400_000_000,
      }),
    ).toEqual([{ timeMs: 130_000, price: 105 }])
    expect(
      buildPositionChartPoints([], 90_000, 150_000, {
        price: 105,
        eventTimeMs: 80_000,
        slot: 400_000_000,
      }),
    ).toEqual([])
  })
  it('replaces equal timestamps with the live observation and respects longer candle intervals', () => {
    expect(
      buildPositionChartPoints(candles, 90_000, 150_000, {
        price: 170,
        eventTimeMs: 120_000,
        slot: null,
      }),
    ).toEqual([{ timeMs: 120_000, price: 170 }])
    expect(
      buildPositionChartPoints(candles.slice(0, 1), 1, 400_000, null, 300_000),
    ).toEqual([{ timeMs: 300_000, price: 100 }])
  })
  it('formats seconds, minutes, and paused durations without negative time', () => {
    expect(formatStreamDuration(-1)).toBe('0s')
    expect(formatStreamDuration(55)).toBe('55s')
    expect(formatStreamDuration(61)).toBe('2m')
    expect(formatStreamDuration(3660)).toBe('1h 1m')
  })
})
