import { useId, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  ChevronDown,
  CirclePause,
  CirclePlay,
  WalletCards,
  Waves,
} from 'lucide-react'
import { formatAtoms, formatPrice } from '../lib/format'
import { getActivePositionMetrics } from '../lib/position-progress'
import {
  getTradePositionEndSlot,
  isBuyTradePosition,
  isPausedTradePosition,
} from '../lib/trade-position'
import { useEndSlotBookkeepingSnapshot } from '../hooks/use-end-slot-bookkeeping-snapshot'
import type { Address } from '@solana/kit'
import type {
  StreamingMarketState,
  TradePositionRecord,
} from '../domain/models'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

export function ActivePositionCard({
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
}: {
  baseDecimals: number
  baseTicker: string
  isCloseDisabled: boolean
  isClosing: boolean
  isControlDisabled: boolean
  isPausing: boolean
  isResuming: boolean
  isWithdrawing: boolean
  marketAddress: Address
  onClose: (tradePositionAddress: Address) => void
  onPauseToggle: (tradePositionAddress: Address) => void
  onWithdraw: (tradePositionAddress: Address) => void
  position: TradePositionRecord
  quoteDecimals: number
  quoteTicker: string
  streamingState: StreamingMarketState | null
}) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
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

  return (
    <Card className="rounded-[20px] border-white/6 bg-white/[0.015] shadow-none">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <button
          aria-controls={detailsId}
          aria-expanded={expanded}
          className="w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          onClick={() => setExpanded((previous) => !previous)}
          type="button"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-start gap-1.5">
                <Badge
                  className="rounded-full"
                  variant={isBuy ? 'positive' : 'negative'}
                >
                  {metrics.sideLabel}
                </Badge>
                {metrics.isPaused ? (
                  <Badge className="rounded-full" variant="muted">
                    Paused
                  </Badge>
                ) : null}
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Waves className="size-3.5" />
                  <span>{metrics.flowLabel}</span>
                </div>
                <p className="mt-1 text-base font-medium tabular-nums">
                  {formatAtoms(metrics.amountAtoms, metrics.depositedDecimals)}{' '}
                  {metrics.depositedToken}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-right">
              <div>
                <p className="text-xs text-muted-foreground">Remaining</p>
                <p className="mt-1 text-sm font-medium tabular-nums">
                  {metrics.remainingPercent.toFixed(1)}%
                </p>
              </div>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            </div>
          </div>
        </button>

        <Progress
          animated={!metrics.isPaused}
          ariaLabel={`${metrics.sideLabel} position progress`}
          className="h-1 bg-white/6"
          indicatorClassName={isBuy ? 'bg-positive' : 'bg-negative'}
          value={metrics.progressPercent}
        />

        {expanded ? (
          <div className="grid gap-2" id={detailsId}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <MetricCard
                label="Deposited"
                value={`${formatAtoms(metrics.amountAtoms, metrics.depositedDecimals)} ${metrics.depositedToken}`}
              />
              <MetricCard
                label="Remaining"
                value={`${formatAtoms(metrics.remainingAtoms, metrics.depositedDecimals)} ${metrics.depositedToken}`}
              />
              <MetricCard
                label="Flow"
                value={`${formatAtoms(metrics.flowAtomsPerSlot, metrics.depositedDecimals)} ${metrics.depositedToken}/slot`}
              />
              <MetricCard
                label="Swapped"
                value={
                  metrics.swappedAtoms === null
                    ? '—'
                    : `${formatAtoms(metrics.swappedAtoms, metrics.swappedDecimals)} ${metrics.swappedToken}`
                }
              />
              <MetricCard
                label="Withdrawable before fee"
                value={
                  metrics.claimableSwappedAtoms === null
                    ? '—'
                    : `${formatAtoms(metrics.claimableSwappedAtoms, metrics.swappedDecimals)} ${metrics.swappedToken}`
                }
              />
              <MetricCard
                icon={<ArrowUpRight className="size-3.5" />}
                label="Average price"
                value={
                  metrics.averagePrice === null
                    ? '—'
                    : `${formatPrice(metrics.averagePrice)} ${quoteTicker}/${baseTicker}`
                }
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            aria-busy={isPausing || isResuming}
            className="h-8 flex-1 rounded-full border-white/8 bg-transparent px-3 text-xs hover:bg-white/5 sm:flex-none"
            disabled={isControlDisabled || !canTogglePause}
            onClick={() => onPauseToggle(position.address)}
            variant="outline"
          >
            {metrics.isPaused ? (
              <CirclePlay className="size-4" />
            ) : (
              <CirclePause className="size-4" />
            )}
            {isPausing
              ? 'Pausing...'
              : isResuming
                ? 'Resuming...'
                : metrics.isPaused
                  ? 'Resume position'
                  : 'Pause position'}
          </Button>
          <Button
            aria-busy={isWithdrawing}
            className="h-8 flex-1 rounded-full border-white/8 bg-transparent px-3 text-xs hover:bg-white/5 sm:flex-none"
            disabled={isControlDisabled || !canWithdraw}
            onClick={() => onWithdraw(position.address)}
            variant="outline"
          >
            <WalletCards className="size-4" />
            {isWithdrawing ? 'Withdrawing...' : 'Withdraw swapped'}
          </Button>
          <Button
            aria-busy={isClosing}
            className="h-8 w-full rounded-full border-white/8 bg-transparent px-3 text-xs text-muted-foreground hover:border-negative/30 hover:bg-negative/5 hover:text-negative sm:ml-auto sm:w-auto"
            disabled={isCloseDisabled}
            onClick={() => onClose(position.address)}
            variant="outline"
          >
            {isClosing ? 'Closing position...' : 'Close position'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="min-w-0 rounded-lg bg-white/[0.025] px-3 py-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="break-words text-sm font-medium tabular-nums text-foreground">
        {value}
      </div>
    </div>
  )
}
