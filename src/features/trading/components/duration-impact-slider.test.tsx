// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DurationImpactSlider } from './duration-impact-slider'
import { MAX_ORDER_DURATION_SECONDS } from '../constants'
import { getDurationSteps } from '../lib/duration-slider'

afterEach(cleanup)

function Slider() {
  const [value, setValue] = useState(60)
  return (
    <DurationImpactSlider
      value={value}
      recommended={10.4}
      steps={getDurationSteps(10.4)}
      impactAt={(seconds) => 60 / seconds}
      onChange={setValue}
    />
  )
}

describe('DurationImpactSlider', () => {
  it('supports arrow keys and keeps keyboard selection within the bounds', () => {
    render(<Slider />)
    const slider = screen.getByRole('slider', { name: 'Order duration' })

    expect(slider.getAttribute('aria-valuemin')).toBe('5')
    expect(slider.getAttribute('aria-valuemax')).toBe(
      String(MAX_ORDER_DURATION_SECONDS),
    )
    expect(slider.getAttribute('aria-valuetext')).toBe(
      '1 minute, +1.000% price impact',
    )
    fireEvent.keyDown(slider, { key: 'ArrowUp' })
    expect(slider.getAttribute('aria-valuenow')).toBe('120')
    fireEvent.keyDown(slider, { key: 'ArrowDown' })
    expect(slider.getAttribute('aria-valuenow')).toBe('60')
    fireEvent.keyDown(slider, { key: 'Home' })
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    expect(slider.getAttribute('aria-valuenow')).toBe('5')
    fireEvent.keyDown(slider, { key: 'End' })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(slider.getAttribute('aria-valuenow')).toBe(
      String(MAX_ORDER_DURATION_SECONDS),
    )
  })

  it('selects on a logarithmic scale and drags only while the pointer is down', () => {
    render(<Slider />)
    const slider = screen.getByRole('slider', { name: 'Order duration' })
    Object.defineProperty(slider, 'setPointerCapture', { value: vi.fn() })
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 0,
      left: 100,
      top: 0,
      right: 780,
      bottom: 280,
      width: 680,
      height: 280,
      toJSON: () => ({}),
    })

    fireEvent.pointerMove(slider, { clientX: 780, pointerId: 1 })
    expect(slider.getAttribute('aria-valuenow')).toBe('60')
    // Halfway along the plot is about 3.5 hours, not half a year.
    fireEvent.pointerDown(slider, { clientX: 446, button: 0, pointerId: 1 })
    expect(slider.getAttribute('aria-valuenow')).toBe('12600')
    fireEvent.pointerMove(slider, { clientX: 780, pointerId: 1 })
    expect(slider.getAttribute('aria-valuenow')).toBe(
      String(MAX_ORDER_DURATION_SECONDS),
    )
    fireEvent.pointerMove(slider, { clientX: 100, pointerId: 1 })
    expect(slider.getAttribute('aria-valuenow')).toBe('5')
    fireEvent.pointerUp(slider, { pointerId: 1 })
    fireEvent.pointerMove(slider, { clientX: 780, pointerId: 1 })
    expect(slider.getAttribute('aria-valuenow')).toBe('5')
  })

  it.each([
    [0.005, '+0.005%', 'text-positive'],
    [-0.005, '−0.005%', 'text-positive'],
    [0.0001, '+<0.001%', 'text-positive'],
    [-0.0001, '−<0.001%', 'text-positive'],
    [0.01, '+0.010%', 'text-muted-foreground'],
    [-0.01, '−0.010%', 'text-muted-foreground'],
    [1, '+1.000%', 'text-muted-foreground'],
    [-1, '−1.000%', 'text-muted-foreground'],
    [1.001, '+1.001%', 'text-destructive'],
    [-1.001, '−1.001%', 'text-destructive'],
    [null, '—', 'text-muted-foreground'],
  ])(
    'shows the same precision and thresholds for impact %s in both readouts',
    (impact, label, className) => {
      render(
        <DurationImpactSlider
          value={60}
          recommended={null}
          steps={getDurationSteps()}
          impactAt={() => impact}
          onChange={vi.fn()}
        />,
      )

      const compactReadout = screen.getByText(
        impact === null ? 'Price impact unavailable' : `${label} impact`,
      )
      const desktopReadout = screen.getByText(`1 min (${label})`)
      expect(compactReadout.classList.contains(className)).toBe(true)
      expect(
        desktopReadout.classList.contains(
          className === 'text-muted-foreground' ? 'text-foreground' : className,
        ),
      ).toBe(true)
      expect(desktopReadout.getAttribute('fill')).toBe('currentColor')
    },
  )

  it.each([
    [0.005, '0.01% impact'],
    [-0.005, '0.01% impact'],
    [0.2, '0.01% impact'],
    [0.5, '0.1% impact'],
    [-0.5, '0.1% impact'],
    [1.2, '0.1% impact'],
    [2, '1% impact'],
    [-2, '1% impact'],
  ])(
    'scales the full curve for a maximum impact of %s',
    (maxImpact, referenceLabel) => {
      const impactAt = (seconds: number) => (maxImpact * 5) / seconds
      const props = {
        recommended: null,
        steps: getDurationSteps(),
        impactAt,
        onChange: vi.fn(),
      }
      const view = render(<DurationImpactSlider {...props} value={60} />)
      const slider = screen.getByRole('slider', { name: 'Order duration' })
      const curve = slider.querySelector('path[stroke="var(--chart-1)"]')!
      const reference = slider.querySelector('line[stroke-dasharray="3 4"]')!
      const initialPath = curve.getAttribute('d')!
      const initialReferenceY = reference.getAttribute('y1')
      expect(screen.getByText(referenceLabel)).toBeTruthy()
      // Even the smallest curve must visibly rise from the 208px baseline.
      const startY = Number(initialPath.match(/^M[\d.]+,([\d.]+)/)![1])
      expect(208 - startY).toBeGreaterThan(40)

      view.rerender(
        <DurationImpactSlider {...props} value={MAX_ORDER_DURATION_SECONDS} />,
      )
      expect(screen.getByText(referenceLabel)).toBeTruthy()
      expect(curve.getAttribute('d')).toBe(initialPath)
      expect(reference.getAttribute('y1')).toBe(initialReferenceY)
    },
  )

  it('keeps decreasing-price curves and markers visible at their impact magnitude', () => {
    const props = {
      value: 60,
      recommended: 10.4,
      steps: getDurationSteps(10.4),
      onChange: vi.fn(),
    }
    const view = render(
      <DurationImpactSlider {...props} impactAt={(seconds) => 60 / seconds} />,
    )
    const slider = screen.getByRole('slider', { name: 'Order duration' })
    const curve = slider.querySelector('path[stroke="var(--chart-1)"]')!
    const recommendation = slider.querySelector(
      'circle[stroke="var(--chart-1)"]',
    )!
    const handle = slider.querySelector('circle[r="22"]')!.parentElement!
    const originalCurve = curve.getAttribute('d')
    const originalRecommendationY = recommendation.getAttribute('cy')
    const originalHandlePosition = handle.getAttribute('transform')

    view.rerender(
      <DurationImpactSlider {...props} impactAt={(seconds) => -60 / seconds} />,
    )

    expect(slider.getAttribute('aria-valuetext')).toBe(
      '1 minute, −1.000% price impact',
    )
    expect(curve.getAttribute('d')).toBe(originalCurve)
    expect(recommendation.getAttribute('cy')).toBe(originalRecommendationY)
    expect(handle.getAttribute('transform')).toBe(originalHandlePosition)
  })
})
