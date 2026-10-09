import { useCallback, useMemo, useState } from 'react'
import type { RefObject } from 'react'
import { ArrowRightLeft } from 'lucide-react'
import { MAX_ORDER_DURATION_SECONDS } from '../constants'
import type { OrderSide } from '../constants'
import { durationToSlots } from '../lib/amounts'
import { isDurationSupportedByAmount } from '../lib/duration'
import {
  getDurationPriceChangePercent,
  getDurationQuote,
} from '../lib/duration-quote'
import type { DurationQuoteInputs } from '../lib/duration-quote'
import {
  formatDuration,
  formatDurationImpact,
  getDurationImpactClassName,
  getDurationSteps,
} from '../lib/duration-slider'
import { DurationImpactSlider } from './duration-impact-slider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'

export type DurationPreviewInputs = Omit<
  DurationQuoteInputs,
  'durationSeconds' | 'side'
>

export function DurationDialog({
  open,
  onOpenChange,
  triggerRef,
  value,
  onDraftChange,
  onApply,
  onReset,
  durationSeconds,
  recommendedDurationSeconds,
  amountInput,
  amountTokenTicker,
  receiveTokenTicker,
  side,
  quoteInputs,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerRef: RefObject<HTMLButtonElement | null>
  value: number
  onDraftChange: (seconds: number) => void
  onApply: (seconds: number) => void
  onReset?: () => void
  durationSeconds: number | null
  recommendedDurationSeconds: number | null
  amountInput: string
  amountTokenTicker: string
  receiveTokenTicker: string
  side: OrderSide
  quoteInputs?: DurationPreviewInputs
}) {
  const [inverse, setInverse] = useState(false)
  const quoteAt = useCallback(
    (seconds: number) =>
      getDurationQuote({
        amountAtoms: null,
        amountUiValue: null,
        streamingState: null,
        indicativePrice: null,
        ...quoteInputs,
        side,
        durationSeconds: seconds,
      }),
    [quoteInputs, side],
  )
  const impactAt = useCallback(
    (seconds: number) =>
      getDurationPriceChangePercent(
        quoteAt(seconds).priceImpactPercent,
        side,
        inverse,
      ),
    [quoteAt, side, inverse],
  )
  const steps = useMemo(
    () => getDurationSteps(durationSeconds, recommendedDurationSeconds),
    [durationSeconds, recommendedDurationSeconds],
  )
  const quote = quoteAt(value)
  const impact = getDurationPriceChangePercent(
    quote.priceImpactPercent,
    side,
    inverse,
  )
  const pickImpact =
    recommendedDurationSeconds === null
      ? null
      : impactAt(recommendedDurationSeconds)
  const baseTicker = side === 'buy' ? receiveTokenTicker : amountTokenTicker
  const quoteTicker = side === 'buy' ? amountTokenTicker : receiveTokenTicker
  const displayRate = (rate: number | null | undefined) =>
    rate != null && Number.isFinite(rate) && rate > 0
      ? inverse
        ? 1 / rate
        : rate
      : null
  const price = displayRate(quoteInputs?.indicativePrice)
  const interval = quoteInputs?.streamingState?.endSlotInterval
  const exceedsAmount =
    quoteInputs?.amountAtoms != null &&
    interval != null &&
    Number.isSafeInteger(interval) &&
    interval > 0
      ? !isDurationSupportedByAmount({
          amountAtoms: quoteInputs.amountAtoms,
          durationSlots: durationToSlots(value),
          endSlotInterval: interval,
        })
      : false
  const estimatedPrice = exceedsAmount
    ? null
    : displayRate(quote.executionPrice)
  const number = (amount: number, decimals = 4) =>
    amount.toLocaleString('en-US', { maximumFractionDigits: decimals })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        finalFocus={triggerRef}
        className="duration-dialog flex flex-col gap-4 overflow-hidden bg-popover p-5 min-[601px]:p-6"
      >
        <DialogTitle className="shrink-0 pr-8 text-xl font-normal">
          Customize duration
        </DialogTitle>
        <DialogDescription className="sr-only">
          Drag the handle or use the arrow keys to compare duration and price
          impact. Use applies your choice; closing keeps your current duration.
        </DialogDescription>
        {open && (
          <>
            <div className="-mx-1 -my-1 min-h-0 space-y-4 overflow-y-auto px-1 py-1">
              <DurationImpactSlider
                value={value}
                recommended={recommendedDurationSeconds}
                steps={steps}
                impactAt={impactAt}
                onChange={onDraftChange}
              />
              <p className="text-center text-sm leading-5 text-muted-foreground">
                {impact === null
                  ? 'Price impact is unavailable with current liquidity.'
                  : 'Estimate from liquidity right now. Price can move while the stream runs.'}
              </p>
              <div className="space-y-3 rounded-lg bg-secondary p-4 shadow-[var(--ring-block)] text-sm tabular-nums min-[601px]:text-base">
                <div aria-label="Price comparison" role="group">
                  <dl className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-muted-foreground">
                        Price now
                      </dt>
                      <dd className="min-w-0 text-right text-muted-foreground [overflow-wrap:anywhere]">
                        {price === null ? '—' : number(price, inverse ? 6 : 4)}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-muted-foreground">
                        Est. price
                      </dt>
                      <dd
                        className="flex min-w-0 flex-wrap justify-end gap-x-1 text-right [overflow-wrap:anywhere]"
                        aria-live="polite"
                        aria-atomic="true"
                      >
                        <span>
                          {estimatedPrice === null
                            ? '—'
                            : number(estimatedPrice, inverse ? 6 : 4)}
                        </span>
                        {estimatedPrice !== null && impact !== null && (
                          <span
                            aria-label="Price impact"
                            className={getDurationImpactClassName(impact)}
                          >
                            ({formatDurationImpact(impact)})
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                    <span className="mr-auto">Including price impact</span>
                    <span className="min-w-0 text-right break-words">
                      {inverse ? baseTicker : quoteTicker} per{' '}
                      {inverse ? quoteTicker : baseTicker}
                    </span>
                    <Button
                      aria-label="Flip price"
                      className="shrink-0"
                      size="icon-xs"
                      title="Flip both prices"
                      variant="ghost"
                      onClick={() => setInverse((current) => !current)}
                    >
                      <ArrowRightLeft className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="shrink-0 text-muted-foreground">
                    {side === 'buy' ? 'Buy with' : 'Sell'}
                  </span>
                  <span className="min-w-0 text-right break-words">
                    {number(Number(amountInput || '0'), 6)} {amountTokenTicker}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3 border-t border-dashed border-[var(--divider)] pt-3">
                  <span className="shrink-0 text-muted-foreground">
                    Est. receive
                  </span>
                  <span
                    className="min-w-0 text-right"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {quote.receiveAmount === null || exceedsAmount
                      ? '—'
                      : `~${number(quote.receiveAmount, 6)}`}{' '}
                    {receiveTokenTicker}
                  </span>
                </div>
              </div>
              {exceedsAmount && (
                <p role="status" className="text-sm text-destructive">
                  This amount is too small for this duration. Choose a shorter
                  duration or increase the amount.
                </p>
              )}
              {recommendedDurationSeconds !== null &&
                recommendedDurationSeconds >= MAX_ORDER_DURATION_SECONDS &&
                value >= MAX_ORDER_DURATION_SECONDS && (
                  <p className="text-sm text-muted-foreground">
                    Maximum duration. Price impact may exceed 0.01%.
                  </p>
                )}
            </div>
            <div className="shrink-0 space-y-3">
              <Button
                className="h-12 w-full rounded-full"
                disabled={exceedsAmount}
                onClick={() => {
                  if (value === recommendedDurationSeconds && onReset) onReset()
                  else onApply(value)
                  onOpenChange(false)
                }}
              >
                Use {formatDuration(value)}
              </Button>
              {recommendedDurationSeconds !== null &&
                onReset &&
                value !== recommendedDurationSeconds && (
                  <button
                    type="button"
                    className="mx-auto block min-h-8 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:rounded focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={() => {
                      onDraftChange(recommendedDurationSeconds)
                    }}
                  >
                    Reset to {formatDuration(recommendedDurationSeconds)} (
                    {formatDurationImpact(pickImpact)})
                  </button>
                )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
