import { useRef, useState } from 'react'
import { AlertTriangle, Info, SlidersHorizontal } from 'lucide-react'
import { Tooltip } from '@base-ui/react/tooltip'
import { SLOT_DURATION_SECONDS } from '../constants'
import { MIN_DURATION_SLOTS } from '../lib/duration'
import { formatOrderDuration } from '../lib/duration-label'
import { formatUiAmount } from '../lib/format'
import type { OrderSide } from '../constants'
import { TokenMark } from './token-mark'
import { DurationDialog } from './duration-dialog'
import type { DurationPreviewInputs } from './duration-dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function OrderEntryCard({
  amountInput,
  amountValidationMessage,
  amountTokenTicker,
  availableAmountDisplay,
  canSubmit,
  durationSeconds,
  durationUnavailableMessage,
  durationQuoteInputs,
  estimatedConversionText,
  executionPriceDisplay,
  isConnected,
  isCustomDuration = false,
  minimumAmountDisplay,
  onAmountChange,
  onDurationChange,
  onResetDuration,
  onMaxClick,
  onPercentSelect,
  onSideChange,
  onSliderChange,
  onSubmit,
  priceImpactDisplay,
  priceImpactWarningText,
  receiveBalanceDisplay,
  receiveTokenTicker,
  recommendedDurationSeconds,
  selectedPercent,
  side,
  statusLabel,
}: {
  amountInput: string
  amountValidationMessage: string | null
  amountTokenTicker: string
  availableAmountDisplay: number
  canSubmit: boolean
  durationSeconds: number | null
  durationUnavailableMessage?: string | null
  durationQuoteInputs?: DurationPreviewInputs
  estimatedConversionText: string
  executionPriceDisplay: string
  isConnected: boolean
  isCustomDuration?: boolean
  minimumAmountDisplay: string
  onAmountChange: (value: string) => void
  onDurationChange: (seconds: number) => void
  onResetDuration?: () => void
  onMaxClick: () => void
  onPercentSelect: (percent: number) => void
  onSideChange: (side: OrderSide) => void
  onSliderChange: (value: number) => void
  onSubmit: () => void
  priceImpactDisplay: string
  priceImpactWarningText: string | null
  receiveBalanceDisplay?: number
  receiveTokenTicker: string
  recommendedDurationSeconds?: number | null
  selectedPercent: number
  side: OrderSide
  statusLabel: string
}) {
  const [showPercentages, setShowPercentages] = useState(false)
  const [durationDialogOpen, setDurationDialogOpen] = useState(false)
  const durationTriggerRef = useRef<HTMLButtonElement>(null)
  const minimumDurationSeconds = MIN_DURATION_SLOTS * SLOT_DURATION_SECONDS
  const [draftDurationSeconds, setDraftDurationSeconds] = useState(
    durationSeconds ?? minimumDurationSeconds,
  )
  const hasAmount = Number(amountInput) > 0
  const smartFillTooltip = `Your ${side} streams continuously over time instead of filling all at once.`
  const receiveSuffix = ` ${receiveTokenTicker}`
  const receiveAmount = estimatedConversionText.endsWith(receiveSuffix)
    ? estimatedConversionText.slice(0, -receiveSuffix.length)
    : estimatedConversionText

  function openDurationDialog() {
    setDraftDurationSeconds(durationSeconds ?? minimumDurationSeconds)
    setDurationDialogOpen(true)
  }

  return (
    <Card className="rounded-[20px]">
      <CardContent className="p-5 sm:p-10">
        <div
          aria-label="Order side"
          className="mb-6 grid grid-cols-2 rounded-full border border-border bg-input p-1"
          role="group"
        >
          {(['buy', 'sell'] as const).map((orderSide) => (
            <Button
              key={orderSide}
              aria-pressed={side === orderSide}
              className={cn(
                'h-9 rounded-full font-normal',
                side === orderSide
                  ? 'border-border bg-secondary text-foreground'
                  : 'text-muted-foreground',
              )}
              onClick={() => {
                if (side !== orderSide) onSideChange(orderSide)
              }}
              variant={side === orderSide ? 'secondary' : 'ghost'}
            >
              {orderSide === 'buy' ? 'Buy' : 'Sell'}
            </Button>
          ))}
        </div>

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

        <div className="flex flex-wrap items-center gap-2 px-1 py-5 text-sm text-muted-foreground">
          {hasAmount ? (
            <>
              {durationSeconds !== null ? <span>Over the next</span> : null}
              <Button
                aria-label={
                  durationSeconds === null
                    ? 'Customize duration'
                    : `Customize duration: ${formatOrderDuration(durationSeconds, isCustomDuration)}`
                }
                aria-haspopup="dialog"
                className="h-auto min-h-7 max-w-full gap-2 rounded-full border-border bg-secondary px-3 py-1 text-xs font-normal whitespace-normal text-foreground/80 hover:text-foreground"
                onClick={openDurationDialog}
                ref={durationTriggerRef}
                variant="secondary"
              >
                {durationSeconds === null
                  ? 'Choose duration'
                  : formatOrderDuration(durationSeconds, isCustomDuration)}
                <SlidersHorizontal aria-hidden="true" className="size-3" />
              </Button>
            </>
          ) : (
            <Tooltip.Provider>
              <span>Smart fill</span>
              <Tooltip.Root>
                <Tooltip.Trigger
                  aria-label="About Smart fill"
                  className="inline-flex cursor-help items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Info aria-hidden="true" className="size-3.5" />
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Positioner sideOffset={8}>
                    <Tooltip.Popup className="z-50 max-w-64 rounded-lg border border-border bg-popover px-3 py-2 text-xs leading-5 text-popover-foreground shadow-lg">
                      {smartFillTooltip}
                    </Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          )}
          {durationUnavailableMessage ? (
            <p className="w-full text-xs leading-5" role="status">
              {durationUnavailableMessage}
            </p>
          ) : null}
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

      <DurationDialog
        open={durationDialogOpen}
        onOpenChange={setDurationDialogOpen}
        triggerRef={durationTriggerRef}
        value={draftDurationSeconds}
        onDraftChange={setDraftDurationSeconds}
        onApply={onDurationChange}
        onReset={onResetDuration}
        durationSeconds={durationSeconds}
        recommendedDurationSeconds={recommendedDurationSeconds ?? null}
        amountInput={amountInput}
        amountTokenTicker={amountTokenTicker}
        receiveTokenTicker={receiveTokenTicker}
        side={side}
        quoteInputs={durationQuoteInputs}
      />
    </Card>
  )
}
