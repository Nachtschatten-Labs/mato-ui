import { useRef, useState } from 'react'
import { AlertTriangle, ArrowDownUp, Info } from 'lucide-react'
import { DURATION_OPTIONS } from '../constants'
import { formatUiAmount } from '../lib/format'
import type { OrderSide } from '../constants'
import { TokenMark } from './token-mark'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export function OrderEntryCard({
  amountInput,
  amountValidationMessage,
  amountTokenTicker,
  availableAmountDisplay,
  canSubmit,
  durationSeconds,
  estimatedConversionText,
  executionPriceDisplay,
  isConnected,
  minimumAmountDisplay,
  onAmountChange,
  onDurationChange,
  onMaxClick,
  onPercentSelect,
  onSideChange,
  onSliderChange,
  onSubmit,
  priceImpactDisplay,
  priceImpactWarningText,
  receiveBalanceDisplay,
  receiveTokenTicker,
  selectedPercent,
  side,
  statusLabel,
}: {
  amountInput: string
  amountValidationMessage: string | null
  amountTokenTicker: string
  availableAmountDisplay: number
  canSubmit: boolean
  durationSeconds: number
  estimatedConversionText: string
  executionPriceDisplay: string
  isConnected: boolean
  minimumAmountDisplay: string
  onAmountChange: (value: string) => void
  onDurationChange: (seconds: number) => void
  onMaxClick: () => void
  onPercentSelect: (percent: number) => void
  onSideChange: (side: OrderSide) => void
  onSliderChange: (value: number) => void
  onSubmit: () => void
  priceImpactDisplay: string
  priceImpactWarningText: string | null
  receiveBalanceDisplay?: number
  receiveTokenTicker: string
  selectedPercent: number
  side: OrderSide
  statusLabel: string
}) {
  const [showPercentages, setShowPercentages] = useState(false)
  const [durationDialogOpen, setDurationDialogOpen] = useState(false)
  const durationTriggerRef = useRef<HTMLButtonElement>(null)
  const [draftDurationSeconds, setDraftDurationSeconds] =
    useState(durationSeconds)
  const receiveSuffix = ` ${receiveTokenTicker}`
  const receiveAmount = estimatedConversionText.endsWith(receiveSuffix)
    ? estimatedConversionText.slice(0, -receiveSuffix.length)
    : estimatedConversionText
  const draftDurationIndex = DURATION_OPTIONS.reduce(
    (closest, option, index) =>
      Math.abs(option.seconds - draftDurationSeconds) <
      Math.abs(DURATION_OPTIONS[closest].seconds - draftDurationSeconds)
        ? index
        : closest,
    0,
  )

  function openDurationDialog() {
    setDraftDurationSeconds(durationSeconds)
    setDurationDialogOpen(true)
  }

  return (
    <Card className="rounded-[20px]">
      <CardContent className="p-5 sm:p-10">
        <div
          className={cn(
            'rounded-xl border bg-input p-4 sm:p-5',
            amountValidationMessage ? 'border-destructive/60' : 'border-border',
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <label className="font-medium" htmlFor="order-amount">
              You pay
            </label>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Balance {formatUiAmount(availableAmountDisplay, 4)}</span>
              <Button
                aria-label="Use maximum balance"
                className="h-6 rounded-md bg-secondary px-1.5 text-[11px] text-foreground"
                onClick={onMaxClick}
                size="xs"
                variant="ghost"
              >
                Max
              </Button>
              <Button
                aria-controls="order-balance-percentage"
                aria-expanded={showPercentages}
                aria-label="Choose balance percentage"
                className="h-6 rounded-md px-1.5 text-xs"
                onClick={() => setShowPercentages((value) => !value)}
                size="xs"
                variant={showPercentages ? 'secondary' : 'ghost'}
              >
                %
              </Button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <Input
              aria-describedby="order-amount-help"
              aria-invalid={amountValidationMessage ? true : undefined}
              autoComplete="off"
              className="h-12 w-0 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 text-[32px] font-normal tracking-tight shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
              id="order-amount"
              inputMode="decimal"
              onChange={(event) => onAmountChange(event.target.value)}
              placeholder="0.00"
              value={amountInput}
            />
            <span className="flex shrink-0 items-center gap-2 text-base font-medium">
              <TokenMark symbol={amountTokenTicker} />
              {amountTokenTicker}
            </span>
            <Button
              aria-label={`Switch to ${side === 'sell' ? 'buy' : 'sell'}`}
              className="rounded-lg bg-secondary text-muted-foreground"
              onClick={() => onSideChange(side === 'sell' ? 'buy' : 'sell')}
              size="icon-sm"
              variant="ghost"
            >
              <ArrowDownUp className="size-3.5" />
            </Button>
          </div>

          <p
            aria-live={amountValidationMessage ? 'polite' : undefined}
            className={cn(
              'mt-1 text-xs leading-5',
              amountValidationMessage
                ? 'text-destructive'
                : 'text-muted-foreground',
            )}
            id="order-amount-help"
          >
            {amountValidationMessage ??
              `Minimum ${minimumAmountDisplay} ${amountTokenTicker}`}
          </p>

          {showPercentages ? (
            <div
              className="mt-4 space-y-3 border-t border-border pt-4"
              id="order-balance-percentage"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <label htmlFor="order-balance-slider">
                  Use available balance
                </label>
                <span>{selectedPercent.toFixed(1)}%</span>
              </div>
              <input
                className="block w-full cursor-pointer accent-primary"
                id="order-balance-slider"
                max={100}
                min={0}
                onChange={(event) => onSliderChange(Number(event.target.value))}
                step={0.1}
                type="range"
                value={selectedPercent}
              />
              <div className="grid grid-cols-4 gap-2">
                {[25, 50, 75, 100].map((percent) => (
                  <Button
                    key={percent}
                    aria-pressed={Math.abs(selectedPercent - percent) < 0.5}
                    className="rounded-full"
                    onClick={() => onPercentSelect(percent)}
                    size="xs"
                    variant={
                      Math.abs(selectedPercent - percent) < 0.5
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {percent}%
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-5 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span>
              Over{' '}
              <span className="text-foreground">
                {formatDuration(durationSeconds)}
              </span>
            </span>
            <span title="Your order executes gradually over the selected duration.">
              <Info
                aria-label="Orders execute gradually over the selected duration"
                className="size-3.5"
              />
            </span>
          </div>
          <Button
            className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
            onClick={openDurationDialog}
            ref={durationTriggerRef}
            variant="link"
          >
            Customize duration
          </Button>
        </div>

        <div className="min-h-[140px] rounded-xl border border-white/[0.06] bg-secondary p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Est. receive</span>
            {receiveBalanceDisplay !== undefined ? (
              <span className="text-xs text-muted-foreground">
                Balance {formatUiAmount(receiveBalanceDisplay, 4)}
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span
              className="min-w-0 truncate text-[32px] leading-[48px] font-normal tracking-tight"
              title={estimatedConversionText}
            >
              {receiveAmount}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-base font-medium">
              <TokenMark symbol={receiveTokenTicker} />
              {receiveTokenTicker}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-5 text-xs text-muted-foreground">
          <span>
            Est. price{' '}
            <span className="text-foreground">{executionPriceDisplay}</span>
          </span>
          <span
            className={cn(priceImpactWarningText && 'text-warning-foreground')}
          >
            Price impact {priceImpactDisplay}
          </span>
        </div>

        {priceImpactWarningText ? (
          <div
            className="mb-4 flex items-start gap-2 rounded-xl border border-warning/25 bg-warning/5 px-3 py-2 text-sm leading-6 text-warning-foreground"
            role="alert"
          >
            <AlertTriangle className="mt-1 size-4 shrink-0" />
            <span>{priceImpactWarningText}</span>
          </div>
        ) : null}

        <Button
          className="h-12 w-full rounded-full text-sm font-medium"
          disabled={!isConnected || !canSubmit}
          onClick={onSubmit}
        >
          {statusLabel}
        </Button>
        <p className="mt-4 text-center text-[11px] leading-5 text-muted-foreground">
          Estimate from liquidity right now. Price can move while the stream
          runs.
        </p>
      </CardContent>

      <Dialog onOpenChange={setDurationDialogOpen} open={durationDialogOpen}>
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[20px] p-6 sm:max-w-lg sm:p-8"
          finalFocus={durationTriggerRef}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-medium">
              Customize duration
            </DialogTitle>
            <DialogDescription className="pr-4 leading-6">
              Spread your order over time. Choose how long your trade should
              take to execute.
            </DialogDescription>
          </DialogHeader>

          <div>
            <div
              className="mb-6 text-center text-3xl tracking-tight"
              aria-live="polite"
            >
              {formatDuration(draftDurationSeconds)}
            </div>
            <input
              aria-label="Order duration"
              aria-valuetext={formatDuration(draftDurationSeconds)}
              className="block w-full cursor-pointer accent-accent-strong"
              max={DURATION_OPTIONS.length - 1}
              min={0}
              onChange={(event) =>
                setDraftDurationSeconds(
                  DURATION_OPTIONS[Number(event.target.value)].seconds,
                )
              }
              step={1}
              type="range"
              value={draftDurationIndex}
            />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{formatDuration(DURATION_OPTIONS[0].seconds)}</span>
              <span>{formatDuration(DURATION_OPTIONS.at(-1)!.seconds)}</span>
            </div>
            <div className="mt-5 grid grid-cols-5 gap-2">
              {DURATION_OPTIONS.map((option) => (
                <Button
                  key={option.label}
                  aria-label={formatDuration(option.seconds)}
                  aria-pressed={draftDurationSeconds === option.seconds}
                  className="rounded-full"
                  onClick={() => setDraftDurationSeconds(option.seconds)}
                  size="sm"
                  variant={
                    draftDurationSeconds === option.seconds
                      ? 'default'
                      : 'secondary'
                  }
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-xl bg-secondary p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Order amount</span>
              <span>
                {amountInput || '0'} {amountTokenTicker}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Duration</span>
              <span>{formatDuration(draftDurationSeconds)}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <span className="text-xs text-muted-foreground">
                Current estimate · {formatDuration(durationSeconds)}
              </span>
              <span>{estimatedConversionText}</span>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Applying a duration updates the estimate. Final amounts depend on
              market prices during execution.
            </p>
          </div>

          <Button
            className="h-12 w-full rounded-full"
            onClick={() => {
              onDurationChange(draftDurationSeconds)
              setDurationDialogOpen(false)
            }}
          >
            Use {formatDuration(draftDurationSeconds)}
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export function formatDuration(seconds: number) {
  const units = [
    { seconds: 365 * 24 * 60 * 60, label: 'year' },
    { seconds: 30 * 24 * 60 * 60, label: 'month' },
    { seconds: 7 * 24 * 60 * 60, label: 'week' },
    { seconds: 24 * 60 * 60, label: 'day' },
    { seconds: 60 * 60, label: 'hour' },
    { seconds: 60, label: 'minute' },
    { seconds: 1, label: 'second' },
  ]
  const unit =
    units.find((candidate) => seconds >= candidate.seconds) ??
    units[units.length - 1]
  const value = Number((seconds / unit.seconds).toFixed(1))
  return `${value} ${unit.label}${value === 1 ? '' : 's'}`
}
