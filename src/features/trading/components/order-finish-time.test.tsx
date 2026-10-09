// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrderFinishTime } from './order-finish-time'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('OrderFinishTime', () => {
  it('updates the local finish time as time passes and the duration changes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 9, 14, 30, 0))
    const view = render(<OrderFinishTime durationSeconds={3600} />)
    expect(screen.getByText(/^Finishes at/).textContent).toBe(
      'Finishes at 15:30',
    )
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByText(/^Finishes at/).textContent).toBe(
      'Finishes at 15:31',
    )
    view.rerender(<OrderFinishTime durationSeconds={600} />)
    expect(screen.getByText(/^Finishes at/).textContent).toBe(
      'Finishes at 14:41',
    )
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('adds date context when the finish crosses midnight or the year', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 11, 31, 23, 30))
    const view = render(<OrderFinishTime durationSeconds={3600} />)
    expect(screen.getByText(/^Finishes at/).textContent).toContain(
      'Finishes at 00:30',
    )
    expect(screen.getByText(/^Finishes at/).textContent).toContain('2027')
    expect(view.container.querySelector('time')?.dateTime).toBe(
      new Date(2027, 0, 1, 0, 30).toISOString(),
    )
  })
})
