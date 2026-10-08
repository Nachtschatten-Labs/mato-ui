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
      '1 minute, −1.00% price impact',
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
})
