import { Fragment, useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, ChevronDown } from 'lucide-react'
import { fetchClosedPositionMiniChart } from '../api/market-repository'
import { useClosedPositionEvents } from '../hooks/use-closed-position-events'
import { useClosedPositionTimes } from '../hooks/use-closed-position-times'
import { POSITION_PAGE_SIZE } from '../constants'
import { tradingQueryRoot } from '../query-keys'
import { clampPage, getPageCount, getPageItems } from '../lib/pagination'
import {
  formatAtoms,
  formatExplorerTransactionUrl,
  formatPrice,
} from '../lib/format'
import { buildClosedPositionSummary } from '../view-models/closed-position'
import { MiniPriceChart } from './mini-price-chart'
import { PositionPagination } from './position-pagination'
import { TokenMark } from './token-mark'
import type { ClosePositionEvent } from '@/integrations/read-api'

interface ClosedPositionMarketProps {
  baseDecimals: number
  baseTicker: string
  marketId: number
  priceHistoryAvailable: boolean
  quoteDecimals: number
  quoteTicker: string
}

export function ClosedPositionsList({
  positionAuthority,
  ...market
}: ClosedPositionMarketProps & { positionAuthority: string }) {
  const eventsQuery = useClosedPositionEvents({
    limit: 50,
    marketId: market.marketId,
    positionAuthority,
  })
  const events = eventsQuery.data ?? []
  const [page, setPage] = useState(0)
  const normalizedPage = clampPage(page, events.length, POSITION_PAGE_SIZE)
  const paginatedEvents = getPageItems({
    items: events,
    page: normalizedPage,
    pageSize: POSITION_PAGE_SIZE,
  })

  return (
    <div className="space-y-4">
      {eventsQuery.isPending ? (
        <p role="status" className="py-5 text-sm text-muted-foreground">
          Loading recent closes...
        </p>
      ) : events.length === 0 && !eventsQuery.error ? (
        <p className="py-5 text-sm text-muted-foreground">
          No closed positions yet.
        </p>
      ) : events.length > 0 ? (
        <table className="w-full table-fixed border-collapse text-left text-xs sm:text-sm">
          <caption className="sr-only">Closed positions</caption>
          <colgroup>
            <col className="w-[32%] sm:w-[36%]" />
            <col className="w-[40%] sm:w-[38%]" />
            <col className="w-[28%] sm:w-[26%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border/60 text-muted-foreground">
              <th scope="col" className="py-3 pl-6 pr-2 font-normal sm:pl-10">
                Asset
              </th>
              <th scope="col" className="px-2 py-3 font-normal sm:px-4">
                Size
              </th>
              <th
                scope="col"
                className="px-2 py-3 text-right font-normal sm:px-4"
              >
                Avg. fill
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedEvents.map((event) => (
              <ClosedPositionRow key={event.id} event={event} {...market} />
            ))}
          </tbody>
        </table>
      ) : null}
      <PositionPagination
        itemLabel="positions"
        onPageChange={setPage}
        page={normalizedPage}
        pageCount={getPageCount(events.length, POSITION_PAGE_SIZE)}
        pageSize={POSITION_PAGE_SIZE}
        totalItems={events.length}
      />
      {eventsQuery.error instanceof Error ? (
        <p role="alert" className="text-sm text-destructive">
          {eventsQuery.error.message}
        </p>
      ) : null}
    </div>
  )
}

function ClosedPositionRow({
  event,
  ...market
}: ClosedPositionMarketProps & { event: ClosePositionEvent }) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const summary = buildClosedPositionSummary({ ...market, event })

  return (
    <Fragment>
      <tr
        className={`cursor-pointer transition-colors hover:bg-white/[0.025] focus-within:bg-white/[0.025] ${expanded ? '' : 'border-b border-border/60'}`}
        onClick={() => setExpanded((previous) => !previous)}
      >
        <td className="py-4 pr-2 align-top">
          <button
            aria-controls={expanded ? detailsId : undefined}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${summary.sideLabel} ${market.baseTicker} position`}
            className="flex w-full items-center gap-2 rounded-sm py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-3"
            type="button"
          >
            <ChevronDown
              aria-hidden="true"
              className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
            <TokenMark
              symbol={market.baseTicker}
              className="hidden size-5 sm:inline-flex"
            />
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="break-all font-medium">{market.baseTicker}</span>
              <span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-xs text-foreground/80">
                {summary.sideLabel}
              </span>
            </span>
          </button>
        </td>
        <td className="px-2 py-4 align-top sm:px-4">
          <div className="space-y-1 tabular-nums">
            <div className="break-words">
              <span className="sr-only">From </span>
              {formatAtoms(summary.consumedAtoms, summary.depositDecimals)}{' '}
              <span className="text-muted-foreground">
                {summary.depositToken}
              </span>
            </div>
            <div className="break-words">
              <span aria-hidden="true" className="mr-1 text-muted-foreground">
                →
              </span>
              <span className="sr-only">To </span>
              {formatAtoms(summary.receivedAtoms, summary.swappedDecimals)}{' '}
              <span className="text-muted-foreground">
                {summary.swappedToken}
              </span>
            </div>
          </div>
        </td>
        <td className="px-2 py-4 text-right align-top tabular-nums sm:px-4">
          <div title="Average fill before fees">
            {summary.averageFillPrice === null
              ? '—'
              : formatPrice(summary.averageFillPrice)}
          </div>
          <div className="mt-1 break-words text-[10px] text-muted-foreground sm:text-xs">
            {market.quoteTicker}/{market.baseTicker}
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-border/60">
          <td colSpan={3} className="pb-5 sm:pl-10">
            <div id={detailsId}>
              <ClosedPositionDetails
                event={event}
                summary={summary}
                {...market}
              />
            </div>
          </td>
        </tr>
      ) : null}
    </Fragment>
  )
}

function formatPositionTime(timeMs: number | null, estimated: boolean) {
  if (timeMs === null) return 'Unavailable'
  const formatted = new Date(timeMs).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${estimated ? '≈ ' : ''}${formatted}`
}

function ClosedPositionDetails({
  event,
  summary,
  marketId,
  priceHistoryAvailable,
  baseTicker,
  quoteTicker,
}: ClosedPositionMarketProps & {
  event: ClosePositionEvent
  summary: ReturnType<typeof buildClosedPositionSummary>
}) {
  const times = useClosedPositionTimes(event)
  const endSlot =
    event.end_slot === null ? null : Math.min(event.end_slot, event.slot)
  const validRange =
    event.start_slot !== null && endSlot !== null && event.start_slot <= endSlot
  const history = useQuery({
    queryKey: [
      ...tradingQueryRoot,
      'closed-position-chart',
      marketId,
      event.start_slot,
      endSlot,
    ],
    enabled: priceHistoryAvailable && validRange,
    staleTime: Infinity,
    retry: false,
    queryFn: () =>
      fetchClosedPositionMiniChart({
        marketId,
        startSlot: event.start_slot!,
        endSlot: endSlot!,
      }),
  })
  const points = history.data ?? []
  const startLabel = formatPositionTime(times.startTimeMs, times.estimatedStart)
  const endLabel = formatPositionTime(times.endTimeMs, times.estimatedEnd)

  return (
    <div className="space-y-5 rounded-lg border border-border/60 bg-white/[0.035] p-4 sm:p-5">
      <dl className="grid gap-4 sm:grid-cols-3">
        <Detail
          label="Started"
          value={times.isLoading ? 'Loading…' : startLabel}
        />
        <Detail label="Ended" value={times.isLoading ? 'Loading…' : endLabel} />
        <Detail
          label="Fee paid"
          value={`${formatAtoms(summary.feeAtoms, summary.swappedDecimals, summary.swappedDecimals)} ${summary.swappedToken}`}
        />
      </dl>
      <div
        className="space-y-2"
        role="group"
        aria-label={`${baseTicker}/${quoteTicker} price movement`}
      >
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {baseTicker}/{quoteTicker} price movement
          </span>
          {points[0] ? (
            <span>
              Started at{' '}
              <span className="tabular-nums text-foreground">
                {formatPrice(points[0].price)}
              </span>
            </span>
          ) : null}
        </div>
        {points.length >= 2 ? (
          <MiniPriceChart
            averagePrice={summary.averageFillPrice}
            averageClassName="stroke-foreground/40"
            lineClassName="stroke-accent-strong"
            points={points}
          />
        ) : (
          <div
            role="status"
            className="flex h-28 items-center justify-center rounded-lg border border-border/50 bg-background/50 text-xs text-muted-foreground"
          >
            {history.isLoading
              ? 'Loading price history…'
              : 'Price history is unavailable.'}
          </div>
        )}
        <div className="flex justify-between gap-4 text-[10px] text-muted-foreground sm:text-xs">
          <span>{times.isLoading ? 'Loading…' : startLabel}</span>
          <span className="text-right">
            {times.isLoading ? 'Loading…' : endLabel}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <a
          className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
          href={formatExplorerTransactionUrl(event.signature, '')}
          target="_blank"
          rel="noreferrer"
        >
          View transaction{' '}
          <ArrowUpRight aria-hidden="true" className="size-3" />
        </a>
        {summary.remainingAtoms > 0n ? (
          <span>
            Refunded{' '}
            {formatAtoms(summary.remainingAtoms, summary.depositDecimals)}{' '}
            {summary.depositToken}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="mb-2 text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
