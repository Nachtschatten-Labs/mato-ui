import { useEffect, useRef, useState } from 'react'
import { Tabs } from '@base-ui/react/tabs'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  Search,
  Star,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { getMarketDefinition, MARKET_DEFINITIONS } from '../constants'
import { useMarketFavorites } from '../hooks/use-market-favorites'
import { filterAndSortMarkets } from '../lib/market-catalog'
import { TokenMark } from './token-mark'
import type { KeyboardEvent } from 'react'
import type { MarketId } from '../constants'
import type {
  MarketSort,
  MarketSortKey,
  MarketStatsById,
  MarketTab,
} from '../lib/market-catalog'

const TABS = [
  { value: 'favorites', label: 'Favorites' },
  { value: 'all', label: 'All' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'equities', label: 'Equities' },
] as const
const COLUMNS: { key: MarketSortKey; label: string; className?: string }[] = [
  { key: 'market', label: 'Market' },
  { key: 'price', label: 'Price' },
  { key: 'change24h', label: '24h change', className: 'hidden sm:table-cell' },
  { key: 'volume24h', label: '24h volume', className: 'hidden md:table-cell' },
]
const priceFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 6,
  minimumFractionDigits: 2,
})
const volumeFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
})
const hasValue = (value: number | null | undefined): value is number =>
  value != null && Number.isFinite(value)
const changeLabel = (value: number | null | undefined) =>
  hasValue(value) ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : '—'

export function MarketSelector({
  disabled = false,
  marketId,
  onMarketChange,
  onOpenChange,
  stats = {},
  isLoading = false,
  hasError = false,
  onRetry,
}: {
  disabled?: boolean
  marketId: MarketId
  onMarketChange: (marketId: MarketId) => void
  onOpenChange?: (open: boolean) => void
  stats?: MarketStatsById
  isLoading?: boolean
  hasError?: boolean
  onRetry?: () => void
}) {
  const market = getMarketDefinition(marketId)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<MarketTab>('all')
  const [sort, setSort] = useState<MarketSort>({
    key: 'market',
    direction: 'asc',
  })
  const { favorites, toggleFavorite } = useMarketFavorites()
  const searchRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const rowRefs = useRef(new Map<MarketId, HTMLButtonElement>())
  const markets = filterAndSortMarkets({ query, tab, favorites, sort, stats })

  function changeOpen(next: boolean) {
    if (next && disabled) return
    setOpen(next)
    if (next) setQuery('')
    onOpenChange?.(next)
  }

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k' &&
        !event.altKey &&
        !disabled
      ) {
        if (document.querySelector('[role="dialog"]')) return
        event.preventDefault()
        triggerRef.current?.click()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [disabled])

  function selectMarket(id: MarketId) {
    if (disabled) return
    if (id !== marketId) onMarketChange(id)
    changeOpen(false)
  }

  function focusRow(index: number) {
    const next = markets[index]
    if (next) {
      const button = rowRefs.current.get(next.id)
      button?.focus()
      button?.scrollIntoView?.({ block: 'nearest' })
    }
  }

  function navigateRows(event: KeyboardEvent, index: number) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusRow((index + 1) % markets.length)
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusRow((index - 1 + markets.length) % markets.length)
    }
    if (event.key === 'Home') {
      event.preventDefault()
      focusRow(0)
    }
    if (event.key === 'End') {
      event.preventDefault()
      focusRow(markets.length - 1)
    }
    if (
      event.key.toLowerCase() === 'f' &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      markets[index]
    ) {
      event.preventDefault()
      changeFavorite(markets[index].id)
    }
  }

  function changeFavorite(id: MarketId) {
    if (tab === 'favorites' && favorites.includes(id)) {
      const index = markets.findIndex((entry) => entry.id === id)
      const next = markets[index + 1] ?? markets[index - 1]
      if (next) rowRefs.current.get(next.id)?.focus()
      else searchRef.current?.focus()
    }
    toggleFavorite(id)
  }

  function sortBy(key: MarketSortKey) {
    setSort((current) => ({
      key,
      direction:
        current.key === key
          ? current.direction === 'asc'
            ? 'desc'
            : 'asc'
          : key === 'market'
            ? 'asc'
            : 'desc',
    }))
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger
        ref={triggerRef}
        disabled={disabled}
        aria-label={`Select market, ${market.baseSymbol}/${market.quoteSymbol}`}
        className="group inline-flex h-12 shrink-0 cursor-pointer items-center gap-3 rounded-full border border-transparent bg-secondary px-4 text-foreground transition-colors hover:border-border hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 data-open:border-accent-strong/40"
      >
        <span aria-hidden="true" className="flex items-center -space-x-2">
          <TokenMark
            symbol={market.baseSymbol}
            className="z-10 size-6 ring-2 ring-secondary"
          />
          <TokenMark
            symbol={market.quoteSymbol}
            className="size-6 ring-2 ring-secondary"
          />
        </span>
        <span className="text-[17px] font-normal tracking-tight">
          {market.baseSymbol}
          <span className="mx-1 text-muted-foreground">/</span>
          {market.quoteSymbol}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="ml-1 size-3.5 text-muted-foreground transition-transform group-data-open:rotate-180"
        />
      </DialogTrigger>

      <DialogContent
        className="flex max-h-[min(680px,calc(100dvh-1.5rem))] max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden rounded-2xl bg-popover p-0 sm:max-w-3xl"
        showCloseButton={false}
        initialFocus={(interaction) =>
          interaction === 'touch' ? false : searchRef.current
        }
        finalFocus={triggerRef}
      >
        <div className="flex shrink-0 items-center justify-between px-5 pt-5 sm:px-6">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-xl tracking-tight">
              Markets
            </DialogTitle>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[10px] font-normal tracking-wide text-muted-foreground">
              <span className="size-1.5 rounded-full bg-accent-strong" />
              DEVNET
            </span>
          </div>
          <DialogClose
            aria-label="Close market selector"
            className="-mr-2 flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <X className="size-4" />
          </DialogClose>
        </div>
        <DialogDescription className="sr-only">
          Search markets, save favorites, or browse crypto and equities. Select
          a column to sort the list.
        </DialogDescription>
        <div className="shrink-0 px-5 pt-4 pb-2 sm:px-6">
          <div className="flex h-11 items-center gap-3 rounded-lg border border-transparent bg-background px-3.5 shadow-[var(--sunk)] transition focus-within:border-ring">
            <Search
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
            <input
              ref={searchRef}
              aria-label="Search markets"
              placeholder="Search markets"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  focusRow(event.key === 'ArrowDown' ? 0 : markets.length - 1)
                }
                if (event.key === 'Enter' && markets[0]) {
                  event.preventDefault()
                  selectMarket(markets[0].id)
                }
              }}
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--t4)] sm:text-sm"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery('')
                  searchRef.current?.focus()
                }}
                className="flex size-7 cursor-pointer items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <Tabs.Root
          value={tab}
          onValueChange={(value) => {
            if (TABS.some((entry) => entry.value === value))
              setTab(value as MarketTab)
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <Tabs.List
            aria-label="Market categories"
            className="flex shrink-0 gap-3 border-b border-border px-5 sm:gap-6 sm:px-6"
          >
            {TABS.map((entry) => (
              <Tabs.Tab
                key={entry.value}
                value={entry.value}
                className="relative flex h-12 cursor-pointer items-center gap-1 border-b-2 border-transparent px-0.5 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:rounded-t focus-visible:bg-secondary data-active:border-accent-strong data-active:text-foreground sm:gap-1.5 sm:text-[13px]"
              >
                {entry.value === 'favorites' && (
                  <Star aria-hidden="true" className="size-3.5" />
                )}
                {entry.label}
                {entry.value === 'favorites' && favorites.length > 0 && (
                  <span className="rounded bg-secondary px-1.5 py-px text-[10px] tabular-nums">
                    {favorites.length}
                  </span>
                )}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          <Tabs.Panel
            value={tab}
            className="h-[320px] min-h-0 overflow-y-auto outline-none"
          >
            <table
              className="w-full table-fixed border-collapse text-sm"
              aria-label="Markets"
            >
              <thead className="sticky top-0 z-10 bg-popover text-[11px] text-muted-foreground">
                <tr>
                  {COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={
                        sort.key === column.key
                          ? sort.direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                      className={cn(
                        'border-b border-border font-normal',
                        column.key === 'market'
                          ? 'w-[70%] pl-5 text-left sm:w-[44%] sm:pl-6'
                          : 'pr-5 text-right sm:pr-6',
                        column.className,
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => sortBy(column.key)}
                        className={cn(
                          'inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-sm outline-none hover:text-foreground focus-visible:text-accent-strong',
                          sort.key === column.key && 'text-foreground',
                        )}
                      >
                        {column.label}
                        {sort.key === column.key ? (
                          sort.direction === 'asc' ? (
                            <ArrowUp aria-hidden="true" className="size-3" />
                          ) : (
                            <ArrowDown aria-hidden="true" className="size-3" />
                          )
                        ) : (
                          <ArrowUpDown
                            aria-hidden="true"
                            className="size-3 opacity-40"
                          />
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {markets.map((entry, index) => {
                  const selected = entry.id === marketId
                  const favorite = favorites.includes(entry.id)
                  const data = stats[entry.id]
                  const changeClass = hasValue(data?.change24h)
                    ? data.change24h > 0
                      ? 'text-positive'
                      : data.change24h < 0
                        ? 'text-negative'
                        : 'text-muted-foreground'
                    : 'text-[var(--t4)]'
                  return (
                    <tr
                      key={entry.id}
                      onClick={() => selectMarket(entry.id)}
                      className={cn(
                        'group cursor-pointer border-b border-border transition-colors hover:bg-muted focus-within:bg-muted',
                        selected && 'bg-accent-strong/[0.06]',
                        disabled && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      <td className="py-1 pl-2 sm:pl-3">
                        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                          <button
                            type="button"
                            aria-label={`${favorite ? 'Remove' : 'Add'} ${entry.baseSymbol}/${entry.quoteSymbol} ${favorite ? 'from' : 'to'} favorites`}
                            aria-pressed={favorite}
                            onClick={(event) => {
                              event.stopPropagation()
                              changeFavorite(entry.id)
                            }}
                            className={cn(
                              'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg outline-none hover:bg-accent-strong/10 hover:text-accent-strong focus-visible:ring-2 focus-visible:ring-ring sm:size-9',
                              favorite
                                ? 'text-accent-strong'
                                : 'text-[var(--t4)]',
                            )}
                          >
                            <Star
                              aria-hidden="true"
                              className={cn(
                                'size-4',
                                favorite && 'fill-current',
                              )}
                            />
                          </button>
                          <button
                            type="button"
                            ref={(node) => {
                              if (node) rowRefs.current.set(entry.id, node)
                              else rowRefs.current.delete(entry.id)
                            }}
                            disabled={disabled}
                            aria-label={`Select ${entry.baseSymbol}/${entry.quoteSymbol}`}
                            aria-current={selected ? 'true' : undefined}
                            onClick={(event) => {
                              event.stopPropagation()
                              selectMarket(entry.id)
                            }}
                            onKeyDown={(event) => navigateRows(event, index)}
                            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg py-3 text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed sm:gap-3 sm:text-sm"
                          >
                            <TokenMark
                              symbol={entry.baseSymbol}
                              className="size-7 sm:size-8"
                            />
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5 whitespace-nowrap font-normal tracking-tight">
                                {entry.baseSymbol}
                                <span className="-ml-1 text-muted-foreground">
                                  /{entry.quoteSymbol}
                                </span>
                                {selected && (
                                  <Check
                                    aria-label="Selected"
                                    className="hidden size-3.5 shrink-0 text-accent-strong sm:block"
                                  />
                                )}
                              </span>
                              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                                {entry.name}
                              </span>
                            </span>
                          </button>
                        </div>
                      </td>
                      <td className="pr-5 text-right text-[13px] tabular-nums sm:pr-6">
                        {isLoading && !data ? (
                          <span
                            aria-label="Loading price"
                            className="inline-block h-3 w-14 animate-pulse rounded bg-secondary motion-reduce:animate-none"
                          />
                        ) : hasValue(data?.price) ? (
                          priceFormatter.format(data.price)
                        ) : (
                          <span className="text-[var(--t4)]">—</span>
                        )}
                        <span
                          className={cn(
                            'mt-1 block text-[10px] sm:hidden',
                            changeClass,
                          )}
                        >
                          {changeLabel(data?.change24h)}
                        </span>
                      </td>
                      <td
                        className={cn(
                          'hidden pr-6 text-right text-[13px] tabular-nums sm:table-cell',
                          changeClass,
                        )}
                      >
                        {changeLabel(data?.change24h)}
                      </td>
                      <td className="hidden pr-6 text-right text-[13px] tabular-nums md:table-cell">
                        {hasValue(data?.volume24h) ? (
                          volumeFormatter.format(data.volume24h)
                        ) : (
                          <span className="text-[var(--t4)]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {markets.length === 0 && (
              <div
                role="status"
                className="flex min-h-56 flex-col items-center justify-center px-6 py-8 text-center"
              >
                <span className="mb-4 flex size-12 items-center justify-center rounded-full border border-border bg-secondary">
                  {tab === 'favorites' && !query ? (
                    <Star className="size-5 text-accent-strong" />
                  ) : (
                    <Search className="size-5 text-muted-foreground" />
                  )}
                </span>
                <p className="font-normal">
                  {query
                    ? 'No markets found'
                    : tab === 'favorites'
                      ? 'Your watchlist starts here'
                      : 'No markets in this category'}
                </p>
                <p className="mt-2 max-w-64 text-xs leading-5 text-muted-foreground">
                  {query
                    ? 'Try another symbol, market name, or token address.'
                    : tab === 'favorites'
                      ? 'Star a market to keep it close. Your favorites are saved in this browser.'
                      : 'Available markets will appear here.'}
                </p>
                {tab === 'favorites' && !query && (
                  <button
                    type="button"
                    onClick={() => setTab('all')}
                    className="mt-4 cursor-pointer rounded-md px-3 py-2 text-xs font-normal text-accent-strong outline-none hover:bg-accent-strong/10 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Browse all markets
                  </button>
                )}
              </div>
            )}
          </Tabs.Panel>
        </Tabs.Root>
        <div className="flex shrink-0 items-start justify-between gap-3 border-t border-border px-5 py-3 text-[10px] leading-4 text-muted-foreground sm:px-6">
          <p>
            {hasError
              ? 'Prices could not be loaded.'
              : 'Market prices in USDC. 24h statistics are not available yet.'}
            {hasError && onRetry && (
              <button
                type="button"
                className="ml-2 cursor-pointer text-accent-strong underline underline-offset-2"
                onClick={onRetry}
              >
                Retry
              </button>
            )}
          </p>
          <span aria-live="polite" className="shrink-0 tabular-nums">
            {markets.length} of {MARKET_DEFINITIONS.length}
          </span>
        </div>
        <div className="hidden shrink-0 items-center gap-5 border-t border-border bg-background px-6 py-3 text-[10px] text-muted-foreground sm:flex">
          <span>
            <kbd className="mr-1.5 rounded bg-secondary px-1.5 py-0.5">↑ ↓</kbd>
            Navigate
          </span>
          <span>
            <kbd className="mr-1.5 rounded bg-secondary px-1.5 py-0.5">↵</kbd>
            Select
          </span>
          <span>
            <kbd className="mr-1.5 rounded bg-secondary px-1.5 py-0.5">F</kbd>
            Favorite
          </span>
          <span className="ml-auto">
            <kbd className="mr-1.5 rounded bg-secondary px-1.5 py-0.5">Esc</kbd>
            Close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
