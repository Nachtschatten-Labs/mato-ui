import { useId, useState } from 'react'
import { formatPrice } from '../lib/format'
import type { PositionChartPoint } from '../lib/position-chart'

const WIDTH = 640
const HEIGHT = 120
const dateLabel = (timeMs: number) =>
  new Date(timeMs).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export function PositionPriceChart({
  points,
  startTimeMs,
  endTimeMs,
  estimatedStart,
  isLoading,
  hasError,
  paused,
}: {
  points: PositionChartPoint[]
  startTimeMs: number | null
  endTimeMs: number | null
  estimatedStart: boolean
  isLoading: boolean
  hasError: boolean
  paused: boolean
}) {
  const gradientId = useId()
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const first = points[0]
  const last = points.at(-1)
  const hovered =
    hoverTime === null
      ? null
      : points.reduce<PositionChartPoint | null>(
          (nearest, point) =>
            !nearest ||
            Math.abs(point.timeMs - hoverTime) <
              Math.abs(nearest.timeMs - hoverTime)
              ? point
              : nearest,
          null,
        )
  const shown = hovered ?? last
  const start = startTimeMs ?? first?.timeMs ?? 0
  const end = Math.max(endTimeMs ?? 0, last?.timeMs ?? 0, start + 1)
  const prices = points.map((point) => point.price)
  const min = prices.length ? Math.min(...prices) : 0
  const max = prices.length ? Math.max(...prices) : 1
  const padding = Math.max((max - min) * 0.2, max * 0.0001)
  const x = (timeMs: number) =>
    8 + ((timeMs - start) / (end - start)) * (WIDTH - 16)
  const y = (price: number) =>
    12 + ((max + padding - price) / (max - min + 2 * padding)) * (HEIGHT - 24)
  const path = points
    .map(
      (point, index) =>
        `${index ? 'L' : 'M'}${x(point.timeMs)},${y(point.price)}`,
    )
    .join(' ')
  const timeLabels = startTimeMs !== null && endTimeMs !== null

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-background/65">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border/40 px-3.5 py-3 text-[11px] sm:px-4">
        <span className="text-muted-foreground">
          SOL/USDC{' '}
          <span className="ml-1 font-mono text-foreground">
            {shown ? formatPrice(shown.price) : '—'}
          </span>
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className="h-px w-4 bg-accent-strong" /> Market price
          {paused && (
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">
              Stream paused
            </span>
          )}
        </span>
      </div>
      <div className="relative px-3.5 pt-3 sm:px-4">
        {points.length > 0 && first && last ? (
          <svg
            role="img"
            aria-label="SOL/USDC market price history since this position started"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            className="block h-32 w-full touch-pan-y"
            onPointerMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect()
              const fraction = Math.max(
                0,
                Math.min(1, (event.clientX - bounds.left) / bounds.width),
              )
              setHoverTime(start + fraction * (end - start))
            }}
            onPointerLeave={() => setHoverTime(null)}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-accent-strong)"
                  stopOpacity="0.13"
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-accent-strong)"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            <line
              x1="8"
              x2={WIDTH - 8}
              y1={y(first.price)}
              y2={y(first.price)}
              stroke="currentColor"
              className="text-muted-foreground/30"
              strokeDasharray="4 5"
              vectorEffect="non-scaling-stroke"
            />
            {points.length > 1 && (
              <path
                d={`${path} L${x(last.timeMs)},${HEIGHT} L${x(first.timeMs)},${HEIGHT} Z`}
                fill={`url(#${gradientId})`}
              />
            )}
            <path
              d={path}
              fill="none"
              stroke="var(--color-accent-strong)"
              strokeWidth="1.75"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={x(last.timeMs)}
              cy={y(last.price)}
              r="4"
              fill="var(--color-accent-strong)"
            />
            {hovered && (
              <>
                <line
                  x1={x(hovered.timeMs)}
                  x2={x(hovered.timeMs)}
                  y1="0"
                  y2={HEIGHT}
                  stroke="currentColor"
                  className="text-muted-foreground/40"
                  strokeDasharray="3 4"
                />
                <circle
                  cx={x(hovered.timeMs)}
                  cy={y(hovered.price)}
                  r="4"
                  fill="var(--foreground)"
                />
              </>
            )}
          </svg>
        ) : (
          <div
            role="status"
            className="flex h-32 items-center justify-center text-xs text-muted-foreground"
          >
            {isLoading
              ? 'Loading price history…'
              : hasError
                ? 'Reference price history is unavailable.'
                : 'Waiting for market prices after this stream started.'}
          </div>
        )}
        <div className="flex justify-between gap-3 border-t border-border/40 pt-2 pb-3 text-[10px] text-muted-foreground">
          <span>
            {hovered
              ? dateLabel(hovered.timeMs)
              : timeLabels
                ? `${estimatedStart ? '≈ ' : ''}${dateLabel(startTimeMs)}`
                : 'Start time unavailable'}
          </span>
          <span className="text-right">
            {timeLabels ? `Est. end ${dateLabel(end)}` : 'Market price'}
          </span>
        </div>
      </div>
    </div>
  )
}
