import type { MarketCandle } from '../api/market-repository'
import type { MarketPriceSnapshot } from '../domain/models'

export interface PositionChartPoint {
  timeMs: number
  price: number
}

export function buildPositionChartPoints(
  candles: readonly MarketCandle[],
  startTimeMs: number,
  nowMs: number,
  latestPrice: MarketPriceSnapshot | null,
  intervalMs = 60_000,
): PositionChartPoint[] {
  // Candle closes belong at the end of their minute, not before the order began.
  const points = candles
    .map((candle) => ({
      timeMs: candle.time * 1000 + intervalMs,
      price: candle.close,
    }))
    .filter(
      (point) =>
        point.timeMs >= startTimeMs &&
        point.timeMs <= nowMs &&
        point.price > 0 &&
        Number.isFinite(point.price),
    )
  if (
    latestPrice?.price != null &&
    latestPrice.eventTimeMs != null &&
    latestPrice.price > 0 &&
    Number.isFinite(latestPrice.price) &&
    latestPrice.eventTimeMs >= startTimeMs &&
    latestPrice.eventTimeMs <= nowMs
  ) {
    points.push({ timeMs: latestPrice.eventTimeMs, price: latestPrice.price })
  }
  return [
    ...new Map(
      points
        .sort((a, b) => a.timeMs - b.timeMs)
        .map((point) => [point.timeMs, point]),
    ).values(),
  ]
}

export function formatStreamDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return '—'
  const rounded = Math.max(0, Math.ceil(seconds))
  if (rounded < 60) return `${rounded}s`
  if (rounded < 3600) return `${Math.ceil(rounded / 60)}m`
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor((rounded % 3600) / 60)
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`
  return `${hours}h${minutes ? ` ${minutes}m` : ''}`
}
