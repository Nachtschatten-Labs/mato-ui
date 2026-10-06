// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MARKET_FAVORITES_KEY } from '../hooks/use-market-favorites'
import { MarketSelector } from './market-selector'

beforeEach(() => {
  // Node 26's native storage shadows jsdom's implementation in Vitest.
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function openSelector() {
  fireEvent.click(screen.getByRole('button', { name: /Select market,/ }))
  return within(await screen.findByRole('dialog'))
}

function visibleMarkets() {
  return screen
    .queryAllByRole('button', { name: /^Select \w+\/USDC$/ })
    .map((button) => button.getAttribute('aria-label'))
}

describe('MarketSelector', () => {
  it('opens a searchable dialog with every market and the current selection', async () => {
    const onOpenChange = vi.fn()
    render(
      <MarketSelector
        marketId={1}
        onMarketChange={vi.fn()}
        onOpenChange={onOpenChange}
      />,
    )
    const dialog = await openSelector()
    expect(dialog.getByRole('textbox', { name: 'Search markets' })).toBeTruthy()
    expect(visibleMarkets()).toEqual(['Select SOL/USDC'])
    expect(
      dialog
        .getByRole('button', { name: 'Select SOL/USDC' })
        .getAttribute('aria-current'),
    ).toBe('true')
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('excludes undeployed markets and supports searching', async () => {
    render(<MarketSelector marketId={1} onMarketChange={vi.fn()} />)
    const dialog = await openSelector()
    fireEvent.click(dialog.getByRole('tab', { name: 'Equities' }))
    expect(visibleMarkets()).toEqual([])
    fireEvent.click(dialog.getByRole('tab', { name: 'Crypto' }))
    fireEvent.change(dialog.getByRole('textbox'), {
      target: { value: 'no such market' },
    })
    expect(dialog.getByText('No markets found')).toBeTruthy()
    fireEvent.click(dialog.getByRole('button', { name: 'Clear search' }))
    expect(visibleMarkets()).toEqual(['Select SOL/USDC'])
  })

  it('persists favorites without selecting the market and supports an empty watchlist', async () => {
    const onMarketChange = vi.fn()
    const first = render(
      <MarketSelector marketId={1} onMarketChange={onMarketChange} />,
    )
    let dialog = await openSelector()
    fireEvent.click(dialog.getByRole('tab', { name: 'Favorites' }))
    expect(dialog.getByText('Your watchlist starts here')).toBeTruthy()
    fireEvent.click(dialog.getByRole('button', { name: 'Browse all markets' }))
    fireEvent.click(
      dialog.getByRole('button', { name: 'Add SOL/USDC to favorites' }),
    )
    expect(onMarketChange).not.toHaveBeenCalled()
    expect(
      JSON.parse(window.localStorage.getItem(MARKET_FAVORITES_KEY)!),
    ).toEqual([1])
    first.unmount()

    render(<MarketSelector marketId={1} onMarketChange={onMarketChange} />)
    dialog = await openSelector()
    fireEvent.click(dialog.getByRole('tab', { name: /Favorites/ }))
    expect(visibleMarkets()).toEqual(['Select SOL/USDC'])
    fireEvent.click(
      dialog.getByRole('button', { name: 'Remove SOL/USDC from favorites' }),
    )
    expect(dialog.getByText('Your watchlist starts here')).toBeTruthy()
  })

  it('keeps favorites usable when browser storage is blocked', async () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })
    render(<MarketSelector marketId={1} onMarketChange={vi.fn()} />)
    const dialog = await openSelector()
    fireEvent.click(
      dialog.getByRole('button', { name: 'Add SOL/USDC to favorites' }),
    )
    fireEvent.click(dialog.getByRole('tab', { name: /Favorites/ }))
    expect(visibleMarkets()).toEqual(['Select SOL/USDC'])
  })

  it('closes when selecting the already active market', async () => {
    const onMarketChange = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <MarketSelector
        marketId={1}
        onMarketChange={onMarketChange}
        onOpenChange={onOpenChange}
      />,
    )
    const dialog = await openSelector()
    fireEvent.click(dialog.getByRole('button', { name: 'Select SOL/USDC' }))
    expect(onMarketChange).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('supports keyboard search, row navigation, favorites, and Escape', async () => {
    render(<MarketSelector marketId={1} onMarketChange={vi.fn()} />)
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    const dialog = within(await screen.findByRole('dialog'))
    const search = dialog.getByRole('textbox')
    await waitFor(() => expect(document.activeElement).toBe(search))
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(
      dialog.getByRole('button', { name: 'Select SOL/USDC' }),
    )
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(document.activeElement).toBe(
      dialog.getByRole('button', { name: 'Select SOL/USDC' }),
    )
    fireEvent.keyDown(document.activeElement!, { key: 'f' })
    expect(
      dialog
        .getByRole('button', { name: 'Remove SOL/USDC from favorites' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: /Select market,/ }),
      ),
    )
  })

  it('accepts the active search match with Enter', async () => {
    const onMarketChange = vi.fn()
    render(<MarketSelector marketId={1} onMarketChange={onMarketChange} />)
    const dialog = await openSelector()
    fireEvent.change(dialog.getByRole('textbox'), {
      target: { value: 'sOl / UsDc' },
    })
    fireEvent.keyDown(dialog.getByRole('textbox'), { key: 'Enter' })
    expect(onMarketChange).not.toHaveBeenCalled()
  })

  it('cannot open while a market change is pending', () => {
    render(<MarketSelector disabled marketId={1} onMarketChange={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /Select market,/ })
    expect(trigger.hasAttribute('disabled')).toBe(true)
    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'k', metaKey: true })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
