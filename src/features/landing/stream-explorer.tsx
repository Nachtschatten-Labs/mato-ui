import { useId, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'
import { MATO_EXPLAINER_URL } from './content'
import {
  EXAMPLE_DURATION,
  examplePriceSegments,
  exampleStreams,
  getExampleClearing,
} from './stream-example'

const format = (value: number) =>
  value.toLocaleString('en-US', { maximumFractionDigits: 2 })
const prices = examplePriceSegments.flatMap(({ price }) =>
  price === null ? [] : [price],
)
const priceY = (price: number) => 78 - ((price - 140) / 30) * 56
const pricePath = examplePriceSegments
  .map(({ start, end, price }, index) =>
    price === null
      ? ''
      : `${index === 0 || examplePriceSegments[index - 1].price === null ? 'M' : 'L'}${start * 10},${priceY(price)} H${end * 10}`,
  )
  .join(' ')

export function StreamExplorer() {
  const [time, setTime] = useState(24)
  const id = useId()
  const { active, price: currentPrice } = getExampleClearing(time)
  // Finished streams contribute no new flow; keep the last recorded price.
  const price = currentPrice ?? prices[prices.length - 1]
  const activeIds = new Set(active.map((stream) => stream.id))
  const position = `${(time / EXAMPLE_DURATION) * 100}%`
  const summary =
    currentPrice === null
      ? `At slot ${format(time)}, all example streams have finished. Last price: ${format(price)} USDC per SOL before fees.`
      : `At slot ${format(time)}, ${active.length} streams trade at ${format(price)} USDC per SOL before fees.`

  function moveMarker(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    if (bounds.width === 0) return
    const next =
      ((event.clientX - bounds.left) / bounds.width) * EXAMPLE_DURATION
    setTime(Math.max(0, Math.min(EXAMPLE_DURATION, next)))
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = {
      ArrowRight: 1,
      ArrowUp: 1,
      ArrowLeft: -1,
      ArrowDown: -1,
      PageUp: 5,
      PageDown: -5,
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setTime(event.key === 'Home' ? 0 : EXAMPLE_DURATION)
    } else if (event.key in steps) {
      event.preventDefault()
      setTime((current) =>
        Math.max(0, Math.min(EXAMPLE_DURATION, current + steps[event.key])),
      )
    }
  }

  return (
    <div className="stream-explorer">
      <div className="explorer-topline">
        <p id={`${id}-instructions`}>
          Drag the line to see the price as streams start and finish.
        </p>
        <span>Illustration · before fees</span>
      </div>
      <div className="explorer-toolbar">
        <div className="explorer-legend" aria-hidden="true">
          <span>
            <i className="legend-buy" /> Buy
          </span>
          <span>
            <i className="legend-sell" /> Sell
          </span>
        </div>
        <div className="explorer-price" aria-live="polite" aria-atomic="true">
          <span>One price for both sides</span>
          <p>
            {format(price)}
            <small> USDC / SOL</small>
          </p>
        </div>
      </div>
      <div
        className="explorer-plot"
        role="slider"
        tabIndex={0}
        aria-label="Explore stream prices"
        aria-valuemin={0}
        aria-valuemax={EXAMPLE_DURATION}
        aria-valuenow={time}
        aria-valuetext={summary}
        aria-describedby={`${id}-instructions`}
        style={{ '--marker-position': position } as CSSProperties}
        onKeyDown={moveWithKeyboard}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return
          event.currentTarget.setPointerCapture(event.pointerId)
          event.currentTarget.focus({ preventScroll: true })
          moveMarker(event)
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            moveMarker(event)
        }}
        onPointerUp={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
          moveMarker(event)
          event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        }}
      >
        <div aria-hidden="true">
          <svg
            className="explorer-price-plot"
            viewBox="0 0 600 100"
            preserveAspectRatio="none"
          >
            <defs>
              <clipPath id={`${id}-past-price`}>
                <rect x="0" y="0" width={time * 10} height="100" />
              </clipPath>
            </defs>
            <path
              d={pricePath}
              fill="none"
              stroke="var(--action)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              clipPath={`url(#${id}-past-price)`}
            />
            <circle
              cx={time * 10}
              cy={priceY(price)}
              r="4"
              fill="var(--brand-mint)"
            />
          </svg>
          {exampleStreams.map((stream) => (
            <div className="explorer-track" key={stream.id}>
              <div
                className={`explorer-stream explorer-stream-${stream.side}`}
                data-active={activeIds.has(stream.id)}
                style={{
                  left: `${(stream.start / EXAMPLE_DURATION) * 100}%`,
                  width: `${((stream.end - stream.start) / EXAMPLE_DURATION) * 100}%`,
                }}
              />
              {activeIds.has(stream.id) && (
                <span className="explorer-intersection" />
              )}
            </div>
          ))}
          <div className="explorer-marker">
            <span>↔</span>
          </div>
        </div>
      </div>
      <div className="explorer-caption">
        <p>
          Each line is one stream. Overlapping buy and sell streams trade at the
          same price.
        </p>
        <a href={MATO_EXPLAINER_URL} target="_blank" rel="noreferrer">
          Watch the original video
        </a>
      </div>
    </div>
  )
}
