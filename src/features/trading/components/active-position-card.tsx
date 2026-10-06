import { useId, useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowRight,
  ChevronDown,
  ExternalLink,
  LoaderCircle,
  Pause,
  Play,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatAtoms,
  formatExplorerAddressUrl,
  formatPrice,
} from '../lib/format'
import { getActivePositionMetrics } from '../lib/position-progress'
import { tradeFeeAtoms } from '../lib/close-position-preview'
import { formatStreamDuration } from '../lib/position-chart'
import { SLOT_DURATION_SECONDS } from '../constants'
import {
  getTradePositionEndSlot,
  isBuyTradePosition,
  isPausedTradePosition,
} from '../lib/trade-position'
import { useEndSlotBookkeepingSnapshot } from '../hooks/use-end-slot-bookkeeping-snapshot'
import { usePositionChart } from '../hooks/use-position-chart'
import { useClosePositionPreview } from '../hooks/use-close-position-preview'
import { TokenMark } from './token-mark'
import { ClosePositionReview } from './close-position-review'
import { PositionPriceChart } from './position-price-chart'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { ReactNode } from 'react'
import type { Address } from '@solana/kit'
import type {
  MarketPriceSnapshot,
  StreamingMarketState,
  TradePositionRecord,
} from '../domain/models'
import type { PositionProgressMetrics } from '../lib/position-progress'

interface ActivePositionCardProps {
  baseDecimals: number
  baseTicker: string
  isCloseDisabled: boolean
  isClosing: boolean
  isControlDisabled: boolean
  isPausing: boolean
  isResuming: boolean
  isWithdrawing: boolean
  marketAddress: Address
  onClose: (tradePositionAddress: Address) => Promise<boolean>
  onPauseToggle: (tradePositionAddress: Address) => void
  onWithdraw: (tradePositionAddress: Address) => void
  position: TradePositionRecord
  quoteDecimals: number
  quoteTicker: string
  streamingState: StreamingMarketState | null
  referencePrice?: MarketPriceSnapshot | null
}

export function ActivePositionCard(props: ActivePositionCardProps) {
  const {
    baseDecimals,
    baseTicker,
    isCloseDisabled,
    isClosing,
    isControlDisabled,
    isPausing,
    isResuming,
    isWithdrawing,
    marketAddress,
    onClose,
    onPauseToggle,
    onWithdraw,
    position,
    quoteDecimals,
    quoteTicker,
    streamingState,
    referencePrice = null,
  } = props
  const [expanded, setExpanded] = useState(true)
  const [closeOpen, setCloseOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const confirmingRef = useRef(false)
  const positionEndSlot = Number(getTradePositionEndSlot(position.data))
  const isBuy = isBuyTradePosition(position.data)
  const isPaused = isPausedTradePosition(position.data)
  const snapshotQuery = useEndSlotBookkeepingSnapshot({
    bookkeepingLastUpdateSlot:
      streamingState?.bookkeepingLastUpdateSlot ?? null,
    enabled: Boolean(
      !isPaused &&
      streamingState &&
      streamingState.currentSlot > positionEndSlot,
    ),
    endSlot: positionEndSlot,
    endSlotInterval: streamingState?.endSlotInterval ?? null,
    isBuy,
    marketAddress,
  })

  const metrics = useMemo(
    () =>
      getActivePositionMetrics({
        baseDecimals,
        baseTicker,
        endSlotBookkeepingSnapshot: snapshotQuery.data ?? null,
        market: marketAddress,
        position: position.data,
        quoteDecimals,
        quoteTicker,
        streamingState,
      }),
    [
      baseDecimals,
      baseTicker,
      marketAddress,
      position.data,
      quoteDecimals,
      quoteTicker,
      snapshotQuery.data,
      streamingState,
    ],
  )
  const hasReachedEnd = Boolean(
    !metrics.isPaused &&
    streamingState &&
    streamingState.currentSlot >= positionEndSlot,
  )
  const canWithdraw =
    !hasReachedEnd &&
    (!metrics.isPaused ||
      metrics.claimableSwappedAtoms === null ||
      metrics.claimableSwappedAtoms > 0n)
  const canTogglePause = metrics.isPaused || !hasReachedEnd

  const chart = usePositionChart({
    enabled: expanded,
    startSlot: position.data.startSlot,
    currentSlot: streamingState?.currentSlot ?? null,
    latestPrice: referencePrice,
  })
  const preview = useClosePositionPreview({
    enabled: closeOpen && !isClosing && !confirming,
    marketAddress,
    positionAddress: position.address,
  })
  async function confirmClose() {
    if (
      confirmingRef.current ||
      isCloseDisabled ||
      !preview.data ||
      preview.isFetching ||
      preview.isError
    )
      return
    if (Date.now() - preview.data.simulatedAtMs > 15_000) {
      void preview.refetch()
      return
    }
    confirmingRef.current = true
    setConfirming(true)
    setCloseError(null)
    try {
      const success = await onClose(position.address)
      if (success) setCloseOpen(false)
      else
        setCloseError(
          'The position was not closed. Review your wallet and try again.',
        )
    } catch {
      setCloseError('The position was not closed. Please try again.')
    } finally {
      confirmingRef.current = false
      setConfirming(false)
    }
  }
  const pending = isClosing || confirming
  const closeAction = (
    <ClosePositionReview
      open={closeOpen}
      onOpenChange={(open) => {
        setCloseOpen(open)
        if (open) setCloseError(null)
      }}
      onConfirm={() => void confirmClose()}
      onRetry={() => {
        setCloseError(null)
        void preview.refetch()
      }}
      preview={preview.data}
      metrics={metrics}
      isLoading={preview.isLoading}
      isRefreshing={preview.isFetching}
      isPending={pending}
      disabled={isCloseDisabled || pending}
      error={
        closeError ??
        (preview.isError
          ? 'Could not calculate your returns. Please check your SOL balance and refresh.'
          : null)
      }
    />
  )
  return (
    <ActivePositionCardView
      metrics={metrics}
      positionAddress={position.address}
      baseTicker={baseTicker}
      quoteTicker={quoteTicker}
      currentSlot={streamingState?.currentSlot ?? null}
      expanded={expanded}
      onToggleExpanded={() => setExpanded((value) => !value)}
      chart={chart}
      closeAction={closeAction}
      isControlDisabled={isControlDisabled || pending}
      isPausing={isPausing}
      isResuming={isResuming}
      isWithdrawing={isWithdrawing}
      canTogglePause={canTogglePause}
      canWithdraw={canWithdraw}
      onPauseToggle={() => onPauseToggle(position.address)}
      onWithdraw={() => onWithdraw(position.address)}
    />
  )
}

export function ActivePositionCardView({
  metrics,
  positionAddress,
  baseTicker,
  quoteTicker,
  currentSlot,
  expanded,
  onToggleExpanded,
  chart,
  closeAction,
  isControlDisabled,
  isPausing,
  isResuming,
  isWithdrawing,
  canTogglePause,
  canWithdraw,
  onPauseToggle,
  onWithdraw,
}: {
  metrics: PositionProgressMetrics
  positionAddress: Address
  baseTicker: string
  quoteTicker: string
  currentSlot: number | null
  expanded: boolean
  onToggleExpanded: () => void
  chart: ReturnType<typeof usePositionChart>
  closeAction: ReactNode
  isControlDisabled: boolean
  isPausing: boolean
  isResuming: boolean
  isWithdrawing: boolean
  canTogglePause: boolean
  canWithdraw: boolean
  onPauseToggle: () => void
  onWithdraw: () => void
}) {
  const detailsId = useId()
  const isBuy = metrics.sideLabel === 'Buy'
  const endSlot = Number(getTradePositionEndSlot(metrics.position))
  const remainingSlots = metrics.isPaused
    ? metrics.position.remainingSlots
    : currentSlot === null
      ? null
      : Math.max(0, endSlot - currentSlot)
  const remainingSeconds =
    remainingSlots === null ? null : remainingSlots * SLOT_DURATION_SECONDS
  const durationSeconds =
    metrics.position.flow > 0n
      ? Number((metrics.amountAtoms * 1_000_000_000n) / metrics.position.flow) *
        SLOT_DURATION_SECONDS
      : null
  const pausedSeconds =
    metrics.isPaused && currentSlot !== null
      ? Math.max(0, currentSlot - Number(metrics.position.pausedAtSlot)) *
        SLOT_DURATION_SECONDS
      : null
  const endTimeMs =
    chart.startTimeMs === null
      ? null
      : chart.startTimeMs +
        (endSlot - Number(metrics.position.startSlot)) *
          SLOT_DURATION_SECONDS *
          1000 +
        (pausedSeconds ?? 0) * 1000
  const netAvailable =
    metrics.claimableSwappedAtoms === null
      ? null
      : metrics.claimableSwappedAtoms -
        tradeFeeAtoms(
          metrics.claimableSwappedAtoms,
          metrics.position.feeBpsAtSubmission,
        )
  const stateLabel = metrics.isPaused
    ? 'Paused'
    : metrics.hasPositionEnded
      ? 'Ended'
      : 'Streaming'
  const amount = (atoms: bigint, decimals: number) =>
    formatAtoms(atoms, decimals)
  const actionClass =
    'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border/60 text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <article
      aria-label={`${metrics.sideLabel} ${baseTicker} stream`}
      className="min-w-0 rounded-xl border border-border/45 bg-background/15"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-4 px-3 py-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:gap-x-3 sm:px-4">
        <div className="min-w-0">
          <p className="mb-3 hidden text-[11px] text-muted-foreground sm:block">
            Stream
          </p>
          <button
            type="button"
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${baseTicker} position`}
            aria-expanded={expanded}
            aria-controls={detailsId}
            onClick={onToggleExpanded}
            className="flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded text-left sm:gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'size-3.5 shrink-0 text-muted-foreground transition-transform',
                expanded && 'rotate-180',
              )}
            />
            <span
              className="hidden -space-x-2 min-[380px]:flex"
              aria-hidden="true"
            >
              <TokenMark
                symbol={metrics.depositedToken}
                className="z-10 size-5 ring-2 ring-card"
              />
              <TokenMark
                symbol={metrics.swappedToken}
                className="size-5 ring-2 ring-card"
              />
            </span>
            <span className="truncate text-xs font-medium">
              {metrics.depositedToken}
            </span>
            <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
            <span className="truncate text-xs">{metrics.swappedToken}</span>
          </button>
          <span
            className={cn(
              'mt-2 ml-6 flex items-center gap-1.5 text-[10px]',
              metrics.isPaused
                ? 'text-muted-foreground'
                : metrics.hasPositionEnded
                  ? 'text-positive'
                  : 'text-accent-strong',
            )}
          >
            <span className="size-1 rounded-full bg-current" />
            {stateLabel}
          </span>
        </div>
        <div className="col-start-1 row-start-2 min-w-0 sm:col-start-2 sm:row-start-1">
          <p className="mb-2 text-[11px] text-muted-foreground">
            {isBuy ? 'Spent' : 'Sold'}
          </p>
          <p
            className="truncate text-[13px] tabular-nums"
            title={`${amount(metrics.consumedAtoms, metrics.depositedDecimals)} of ${amount(metrics.amountAtoms, metrics.depositedDecimals)} ${metrics.depositedToken}`}
          >
            <span>
              {amount(metrics.consumedAtoms, metrics.depositedDecimals)}
            </span>
            <span className="text-muted-foreground">
              {' '}
              / {amount(metrics.amountAtoms, metrics.depositedDecimals)}
            </span>
          </p>
          <Progress
            animated={!metrics.isPaused && !metrics.hasPositionEnded}
            ariaLabel={`${metrics.sideLabel} position progress`}
            value={metrics.progressPercent}
            className="mt-2 h-1 bg-secondary"
            indicatorClassName="bg-accent-strong"
          />
        </div>
        <div className="col-start-2 row-start-2 min-w-0 text-right sm:col-start-3 sm:row-start-1 sm:text-left">
          <p className="mb-2 text-[11px] text-muted-foreground">
            Avg. fill <span className="hidden lg:inline">· {quoteTicker}</span>
          </p>
          <p className="text-[13px] tabular-nums">
            {metrics.averagePrice === null
              ? '—'
              : formatPrice(metrics.averagePrice)}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {metrics.progressPercent.toFixed(1)}% filled
          </p>
        </div>
        <div className="col-start-2 row-start-1 flex items-center gap-2 self-start sm:col-start-4 sm:mt-7">
          <button
            type="button"
            className={actionClass}
            aria-label={metrics.isPaused ? 'Resume position' : 'Pause position'}
            title={metrics.isPaused ? 'Resume position' : 'Pause position'}
            aria-busy={isPausing || isResuming}
            disabled={isControlDisabled || !canTogglePause}
            onClick={onPauseToggle}
          >
            {isPausing || isResuming ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : metrics.isPaused ? (
              <Play className="size-3.5" />
            ) : (
              <Pause className="size-3.5" />
            )}
          </button>
          {closeAction}
        </div>
      </div>
      {expanded && (
        <div
          id={detailsId}
          className="mx-3 mb-3 space-y-5 rounded-lg border border-border/30 bg-secondary/35 p-3.5 sm:mx-4 sm:mb-4 sm:p-4"
        >
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 min-[380px]:grid-cols-2 sm:grid-cols-3">
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">
                Received <span className="text-[10px]">before fees</span>
              </p>
              <p className="mt-2 break-words text-[15px] tabular-nums">
                {metrics.swappedAtoms === null
                  ? '—'
                  : amount(metrics.swappedAtoms, metrics.swappedDecimals)}{' '}
                <span className="text-[10px] text-muted-foreground">
                  {metrics.swappedToken}
                </span>
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">
                Available after fee
              </p>
              <p className="mt-2 break-words text-[15px] tabular-nums">
                {netAvailable === null
                  ? '—'
                  : amount(netAvailable, metrics.swappedDecimals)}{' '}
                <span className="text-[10px] text-muted-foreground">
                  {metrics.swappedToken}
                </span>
              </p>
              <Button
                aria-busy={isWithdrawing}
                disabled={
                  isControlDisabled ||
                  !canWithdraw ||
                  netAvailable === null ||
                  netAvailable <= 0n
                }
                onClick={onWithdraw}
                variant="outline"
                className="mt-3 h-7 rounded-md border-border/60 bg-transparent px-2.5 text-[11px]"
              >
                <ArrowDownToLine className="size-3" />
                {isWithdrawing ? 'Withdrawing…' : 'Withdraw swapped'}
              </Button>
            </div>
            <div className="col-span-1 flex items-start justify-between gap-3 min-[380px]:col-span-2 sm:col-span-1 sm:block">
              <div>
                <p className="text-[11px] text-muted-foreground">Time left</p>
                <p className="mt-2 text-[15px] tabular-nums">
                  {remainingSeconds === null
                    ? '—'
                    : remainingSeconds === 0
                      ? 'Ended'
                      : `≈ ${formatStreamDuration(remainingSeconds)}`}
                  <span className="ml-1.5 text-[10px] text-muted-foreground">
                    {durationSeconds === null
                      ? ''
                      : `of ${formatStreamDuration(durationSeconds)}`}
                  </span>
                </p>
              </div>
              {metrics.isPaused && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Paused
                  {pausedSeconds === null
                    ? ''
                    : ` for ≈ ${formatStreamDuration(pausedSeconds)}`}
                </p>
              )}
            </div>
          </div>
          <PositionPriceChart
            {...chart}
            endTimeMs={endTimeMs}
            paused={metrics.isPaused}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <a
              href={formatExplorerAddressUrl(positionAddress, '')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline decoration-muted-foreground/40 underline-offset-3 hover:text-foreground"
            >
              View position <ExternalLink className="size-3" />
            </a>
            <span>
              Fill estimates · {quoteTicker}/{baseTicker}
            </span>
          </div>
        </div>
      )}
    </article>
  )
}
