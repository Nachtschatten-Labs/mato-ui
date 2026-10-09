// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { InfoTooltip } from './info-tooltip'

afterEach(cleanup)

describe('InfoTooltip', () => {
  it('opens on touch, stays open after pointer leave, and closes on a second tap', async () => {
    render(
      <InfoTooltip label="About Smart fill">
        Smart fill explanation.
      </InfoTooltip>,
    )
    const trigger = screen.getByRole('button', { name: 'About Smart fill' })
    const tap = () => {
      fireEvent.pointerDown(trigger, { pointerType: 'touch' })
      fireEvent.pointerUp(trigger, { pointerType: 'touch' })
      fireEvent.click(trigger)
    }
    tap()
    const popup = await screen.findByRole('dialog')
    expect(popup.textContent).toBe('Smart fill explanation.')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    fireEvent.pointerLeave(trigger, { pointerType: 'touch' })
    expect(screen.getByRole('dialog')).toBe(popup)
    tap()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('dismisses with Escape or an outside click', async () => {
    render(
      <>
        <InfoTooltip label="About fee">Fee explanation.</InfoTooltip>
        <button>Outside</button>
      </>,
    )
    const trigger = screen.getByRole('button', { name: 'About fee' })
    fireEvent.click(trigger)
    await screen.findByRole('dialog')
    fireEvent.keyDown(trigger, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(trigger)
    await screen.findByRole('dialog')
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }))
    fireEvent.click(screen.getByRole('button', { name: 'Outside' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('also opens on desktop hover', async () => {
    render(
      <InfoTooltip label="About Estimated Rate">Rate explanation.</InfoTooltip>,
    )
    const trigger = screen.getByRole('button', { name: 'About Estimated Rate' })
    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' })
    fireEvent.mouseEnter(trigger)
    fireEvent.mouseMove(trigger)
    expect((await screen.findByRole('dialog')).textContent).toBe(
      'Rate explanation.',
    )
  })
})
