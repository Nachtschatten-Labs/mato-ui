import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { MAX_ORDER_DURATION_SECONDS } from '../constants'
import {
  durationAtFraction,
  durationToFraction,
  formatDuration,
  formatDurationImpact,
  getDurationImpactClassName,
  getDurationImpactScale,
  MIN_SLIDER_DURATION_SECONDS,
} from '../lib/duration-slider'

export function DurationImpactSlider({
  value,
  recommended,
  steps,
  impactAt,
  onChange,
}: {
  value: number
  recommended: number | null
  steps: number[]
  impactAt: (seconds: number) => number | null
  onChange: (seconds: number) => void
}) {
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 600px)')
    if (!media) return
    const update = () => setCompact(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const gradientId = useId()
  const dragging = useRef(false)
  const width = compact ? 350 : 680
  const left = compact ? 26 : 76
  const right = width - (compact ? 26 : 64)
  const top = compact ? 28 : 66
  const baseline = compact ? 174 : 208
  const height = baseline + (compact ? 46 : 50)
  const samples = useMemo(
    () =>
      Array.from({ length: 161 }, (_, i) => {
        const seconds =
          MIN_SLIDER_DURATION_SECONDS *
          (MAX_ORDER_DURATION_SECONDS / MIN_SLIDER_DURATION_SECONDS) **
            (i / 160)
        return { fraction: i / 160, impact: impactAt(seconds) }
      }),
    [impactAt],
  )
  // Plot magnitude so both price increases and decreases rise above zero.
  // Scale to the whole curve so dragging the duration does not move the axes.
  const { referenceImpact, yMax } = getDurationImpactScale(
    Math.max(0, ...samples.map(({ impact }) => Math.abs(impact ?? 0))),
  )
  const x = (seconds: number) =>
    left + (right - left) * durationToFraction(seconds)
  const y = (impact: number) =>
    baseline - ((baseline - top) * Math.abs(impact)) / yMax
  const impact = impactAt(value)
  const pickImpact = recommended === null ? null : impactAt(recommended)
  const handleX = x(value)
  const handleY = impact === null ? baseline : y(impact)
  let previousKnown = false
  const path = samples
    .map(({ fraction, impact: pointImpact }) => {
      if (pointImpact === null) {
        previousKnown = false
        return ''
      }
      const command = previousKnown ? 'L' : 'M'
      previousKnown = true
      return `${command}${(left + (right - left) * fraction).toFixed(2)},${y(pointImpact).toFixed(2)}`
    })
    .join(' ')
  const tickStep =
    10 ** Math.floor(Math.log10(yMax / 3)) *
    ([1, 2, 5, 10].find(
      (step) => yMax / (step * 10 ** Math.floor(Math.log10(yMax / 3))) <= 4,
    ) ?? 10)
  const yTicks = Array.from(
    { length: Math.floor(yMax / tickStep) + 1 },
    (_, i) => i * tickStep,
  )
  const ticks: Array<[number, string]> = compact
    ? [
        [5, '5 s'],
        [60, '1 min'],
        [3600, '1 h'],
        [86400, '1 day'],
        [MAX_ORDER_DURATION_SECONDS, '1 yr'],
      ]
    : [
        [5, '5 s'],
        [60, '1 min'],
        [3600, '1 hour'],
        [86400, '1 day'],
        [604800, '1 wk'],
        [2592000, '1 mo'],
        [MAX_ORDER_DURATION_SECONDS, '1 year'],
      ]
  const label = `${formatDuration(value, true)} (${formatDurationImpact(impact)})`
  const bubbleWidth = Math.max(108, label.length * 7.5 + 24)
  const bubbleX = Math.max(
    left - 22 + bubbleWidth / 2,
    Math.min(width - bubbleWidth / 2 - 2, handleX),
  )

  function fromPointer(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0) return
    const position = ((event.clientX - rect.left) / rect.width) * width
    onChange(durationAtFraction((position - left) / (right - left), steps))
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    let next: number | undefined
    if (event.key === 'Home') next = steps[0]
    if (event.key === 'End') next = steps.at(-1)
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp')
      next = steps.find((step) => step > value) ?? steps.at(-1)
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')
      next = steps.filter((step) => step < value).at(-1) ?? steps[0]
    if (next !== undefined) {
      event.preventDefault()
      onChange(next)
    }
  }

  return (
    <div>
      <div className="mb-1 text-center min-[601px]:hidden" aria-hidden="true">
        <div className="text-[32px] tracking-tight">
          {formatDuration(value)}
        </div>
        <div className={getDurationImpactClassName(impact)}>
          {impact === null
            ? 'Price impact unavailable'
            : `${formatDurationImpact(impact)} impact`}
        </div>
      </div>
      <svg
        className="block w-full touch-none cursor-ew-resize select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        viewBox={`0 0 ${width} ${height}`}
        role="slider"
        tabIndex={0}
        aria-label="Order duration"
        aria-orientation="horizontal"
        aria-valuemin={MIN_SLIDER_DURATION_SECONDS}
        aria-valuemax={MAX_ORDER_DURATION_SECONDS}
        aria-valuenow={value}
        aria-valuetext={`${formatDuration(value)}, ${impact === null ? 'price impact unavailable' : `${formatDurationImpact(impact)} price impact`}`}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.currentTarget.focus()
          event.currentTarget.setPointerCapture(event.pointerId)
          dragging.current = true
          fromPointer(event)
        }}
        onPointerMove={(event) => {
          if (dragging.current) fromPointer(event)
        }}
        onPointerUp={() => {
          dragging.current = false
        }}
        onPointerCancel={() => {
          dragging.current = false
        }}
        onLostPointerCapture={() => {
          dragging.current = false
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--chart-1)" stopOpacity="0.18" />
            <stop offset="1" stopColor="var(--chart-1)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {samples.every((point) => point.impact !== null) && (
          <path
            d={`${path} L${right},${baseline} L${left},${baseline} Z`}
            fill={`url(#${gradientId})`}
          />
        )}
        {!compact && (
          <>
            <line
              x1={left - 24}
              y1={top - 10}
              x2={left - 24}
              y2={baseline}
              stroke="var(--muted-foreground)"
              strokeOpacity="0.5"
            />
            {yTicks.map((tick) => (
              <text
                key={tick}
                x={left - 32}
                y={y(tick) + 4}
                textAnchor="end"
                fontSize="12"
                fill="var(--muted-foreground)"
              >
                {Number(tick.toPrecision(3))}%
              </text>
            ))}
          </>
        )}
        <line
          x1={compact ? left : left - 24}
          y1={y(referenceImpact)}
          x2={right}
          y2={y(referenceImpact)}
          stroke="var(--muted-foreground)"
          strokeDasharray="3 4"
        />
        <text
          x={right}
          y={y(referenceImpact) - 8}
          textAnchor="end"
          fontSize="12"
          fill="var(--muted-foreground)"
        >
          {referenceImpact}% impact
        </text>
        <path d={path} fill="none" stroke="var(--chart-1)" strokeWidth="2" />
        <line
          x1={compact ? left : left - 24}
          y1={baseline}
          x2={right}
          y2={baseline}
          stroke="var(--muted-foreground)"
          strokeOpacity="0.5"
        />
        {steps.map((seconds) => (
          <line
            key={seconds}
            x1={x(seconds)}
            x2={x(seconds)}
            y1={baseline}
            y2={baseline + 3}
            stroke="var(--border)"
          />
        ))}
        {ticks.map(([seconds, text]) => (
          <g key={seconds}>
            <line
              x1={x(seconds)}
              x2={x(seconds)}
              y1={baseline}
              y2={baseline + 6}
              stroke="var(--muted-foreground)"
            />
            <text
              x={x(seconds)}
              y={baseline + 36}
              textAnchor={
                seconds === 5
                  ? 'start'
                  : seconds === MAX_ORDER_DURATION_SECONDS
                    ? 'end'
                    : 'middle'
              }
              fontSize={compact ? 12 : 14}
              fill="var(--muted-foreground)"
            >
              {text}
            </text>
          </g>
        ))}
        {recommended !== null && pickImpact !== null && (
          <circle
            cx={x(recommended)}
            cy={y(pickImpact)}
            r="6"
            fill="var(--card)"
            stroke="var(--chart-1)"
            strokeWidth="2"
          >
            <title>Smart fill: {formatDuration(recommended)}</title>
          </circle>
        )}
        <line
          x1={handleX}
          x2={handleX}
          y1={handleY}
          y2={baseline}
          stroke="var(--muted-foreground)"
          strokeDasharray="3 3"
        />
        <g transform={`translate(${handleX}, ${handleY})`}>
          <circle r="22" fill="var(--primary)" />
          <path
            d="M-8,-5 L-13,0 L-8,5 M8,-5 L13,0 L8,5"
            fill="none"
            stroke="var(--primary-foreground)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        {!compact && (
          <g transform={`translate(${bubbleX}, ${handleY - 42})`}>
            <rect
              x={-bubbleWidth / 2}
              y="-15"
              width={bubbleWidth}
              height="30"
              rx="8"
              fill="var(--secondary)"
            />
            <text
              y="5"
              textAnchor="middle"
              fontSize="14"
              className={getDurationImpactClassName(impact, 'text-foreground')}
              fill="currentColor"
            >
              {label}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}
