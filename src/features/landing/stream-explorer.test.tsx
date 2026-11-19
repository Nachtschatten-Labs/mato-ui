// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StreamExplorer } from './stream-explorer'

afterEach(cleanup)

describe('StreamExplorer', () => {
  it('updates the price, highlighted streams, and accessible summary together', () => {
    const { container } = render(<StreamExplorer />)
    const slider = screen.getByRole('slider', { name: 'Explore stream prices' })
    expect(screen.getByText('154.75')).toBeTruthy()
    expect(
      container.querySelectorAll('.explorer-stream[data-active="true"]'),
    ).toHaveLength(6)

    for (let i = 0; i < 14; i++)
      fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(screen.getByText('147.63')).toBeTruthy()
    expect(
      container.querySelectorAll('.explorer-stream[data-active="true"]'),
    ).toHaveLength(5)
    expect(slider.getAttribute('aria-valuetext')).toContain(
      'At slot 38, 5 streams trade at 147.63 USDC per SOL before fees.',
    )

    fireEvent.keyDown(slider, { key: 'End' })
    expect(screen.getByText('155')).toBeTruthy()
    expect(slider.getAttribute('aria-valuetext')).toContain('Last price: 155')
    expect(screen.queryByText('No exchange')).toBeNull()
    expect(container.querySelectorAll('.explorer-intersection')).toHaveLength(0)
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(slider.getAttribute('aria-valuenow')).toBe('60')
    fireEvent.keyDown(slider, { key: 'Home' })
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    expect(slider.getAttribute('aria-valuenow')).toBe('0')
  })

  it('scrubs on the plot, clamps a captured drag, and stops after cancellation', () => {
    const { container } = render(<StreamExplorer />)
    const plot = container.querySelector('.explorer-plot')!
    const slider = screen.getByRole('slider', {
      name: 'Explore stream prices',
    })
    let captured = false
    Object.assign(plot, {
      setPointerCapture: vi.fn(() => {
        captured = true
      }),
      hasPointerCapture: vi.fn(() => captured),
      releasePointerCapture: vi.fn(() => {
        captured = false
      }),
    })
    vi.spyOn(plot, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 0,
      left: 100,
      top: 0,
      right: 700,
      bottom: 400,
      width: 600,
      height: 400,
      toJSON: () => ({}),
    })
    fireEvent.pointerMove(plot, { clientX: 400, pointerId: 1 })
    expect(slider.getAttribute('aria-valuenow')).toBe('24')
    fireEvent.pointerDown(plot, {
      clientX: 382.5,
      pointerId: 1,
      isPrimary: true,
      button: 0,
    })
    expect(Number(slider.getAttribute('aria-valuenow'))).toBeCloseTo(28.25)
    const historyClip = container.querySelector('clipPath rect')!
    expect(Number(historyClip.getAttribute('width'))).toBeCloseTo(282.5)
    expect(document.activeElement).toBe(slider)
    fireEvent.pointerMove(plot, { clientX: 800, pointerId: 1 })
    expect(slider.getAttribute('aria-valuenow')).toBe('60')
    expect(Number(historyClip.getAttribute('width'))).toBe(600)
    fireEvent.pointerMove(plot, { clientX: 50, pointerId: 1 })
    expect(slider.getAttribute('aria-valuenow')).toBe('0')
    expect(Number(historyClip.getAttribute('width'))).toBe(0)
    fireEvent.pointerCancel(plot, { pointerId: 1 })
    fireEvent.pointerMove(plot, { clientX: 400, pointerId: 1 })
    expect(slider.getAttribute('aria-valuenow')).toBe('0')
  })
})
