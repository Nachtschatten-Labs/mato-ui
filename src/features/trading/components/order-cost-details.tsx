import { useId, useState } from 'react'
import { ArrowRightLeft, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import type { OrderSide } from '../constants'

export interface OrderCostDetailsProps {
  hasAmount: boolean
  baseTicker: string
  quoteTicker: string
  receiveTokenTicker: string
  indicativePrice: number | null
  executionPrice: number | null
  side: OrderSide
  priceImpactDisplay: string
  priceImpactCost: number | null
  hasHighPriceImpact: boolean
  feePercent: number | null
  feeAmount: number | null
}

function number(value: number | null, decimals: number) {
  if (value === null || !Number.isFinite(value)) return '—'
  if (value > 0 && value < 10 ** -decimals)
    return `<${(10 ** -decimals).toFixed(decimals)}`
  return value.toLocaleString('en-US', { maximumFractionDigits: decimals })
}

export function OrderCostDetails({
  hasAmount,
  baseTicker,
  quoteTicker,
  receiveTokenTicker,
  indicativePrice,
  executionPrice,
  side,
  priceImpactDisplay,
  priceImpactCost,
  hasHighPriceImpact,
  feePercent,
  feeAmount,
}: OrderCostDetailsProps) {
  const [open, setOpen] = useState(false)
  const [inverse, setInverse] = useState(false)
  const detailsId = useId()
  const rate =
    indicativePrice !== null &&
    Number.isFinite(indicativePrice) &&
    indicativePrice > 0
      ? indicativePrice
      : null
  const estimatedRate =
    executionPrice !== null &&
    Number.isFinite(executionPrice) &&
    executionPrice > 0
      ? executionPrice
      : null
  const impact =
    priceImpactDisplay === '—'
      ? '—'
      : `${side === 'buy' ? '+' : '−'}${priceImpactDisplay}`
  const fee = feePercent === null ? '—' : `${number(feePercent, 2)}%`
  const decimals = receiveTokenTicker === 'USDC' ? 2 : 6
  const cost = (value: number | null) =>
    `${value === null ? '' : '≈'}${number(value, decimals)} ${receiveTokenTicker}`
  const controlClass =
    'inline-flex cursor-pointer items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <div className="space-y-3 px-1 py-5 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span>
          1 {baseTicker} ≈{' '}
          <span className="text-foreground">{number(rate, 2)}</span>{' '}
          {quoteTicker}
        </span>
        {hasAmount ? (
          <button
            aria-controls={detailsId}
            aria-expanded={open}
            aria-label="Price impact and fee details"
            className={controlClass}
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            Impact{' '}
            <span
              className={cn(
                'text-foreground',
                hasHighPriceImpact && 'text-destructive',
              )}
            >
              {impact}
            </span>
            <span aria-hidden="true">·</span> Fee{' '}
            <span className="text-foreground">{fee}</span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'ml-1 size-3.5 transition-transform motion-reduce:transition-none',
                open && 'rotate-180',
              )}
            />
          </button>
        ) : null}
      </div>
      {hasAmount && open ? (
        <div
          id={detailsId}
          className="space-y-3 rounded-[var(--r-row)] bg-secondary/40 px-4 py-3 shadow-[var(--ring-block)]"
        >
          <dl className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <dt className="flex items-center gap-1">
                Estimated Rate
                <InfoTooltip label="About Estimated Rate">
                  The estimated rate after price impact, before fees. The final
                  rate can change while your stream runs.
                </InfoTooltip>
              </dt>
              <dd className="ml-auto flex flex-wrap items-center justify-end gap-2 text-foreground">
                <span>
                  {inverse
                    ? `1 ${quoteTicker} ≈ ${number(estimatedRate === null ? null : 1 / estimatedRate, 6)} ${baseTicker}`
                    : `1 ${baseTicker} ≈ ${number(estimatedRate, 4)} ${quoteTicker}`}
                </span>
                <button
                  aria-label="Flip rate"
                  className={cn(
                    controlClass,
                    'size-6 justify-center text-muted-foreground',
                  )}
                  type="button"
                  onClick={() => setInverse((value) => !value)}
                >
                  <ArrowRightLeft aria-hidden="true" className="size-3.5" />
                </button>
              </dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <dt className="flex items-center gap-1">
                Price impact
                <InfoTooltip label="About price impact">
                  Your stream's estimated effect on the {baseTicker} price in{' '}
                  {quoteTicker}. The cost is how much less {receiveTokenTicker}{' '}
                  you receive because of price impact, before fees.
                </InfoTooltip>
              </dt>
              <dd className="ml-auto flex flex-wrap justify-end gap-x-1">
                <span
                  className={cn(
                    'text-foreground',
                    hasHighPriceImpact && 'text-destructive',
                  )}
                >
                  {impact}
                </span>
                <span>· {cost(priceImpactCost)}</span>
              </dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <dt className="flex items-center gap-1">
                Fee
                <InfoTooltip label="About fee">
                  The fee is deducted from the {receiveTokenTicker} you receive
                  and is already included in Est. receive.
                </InfoTooltip>
              </dt>
              <dd className="ml-auto flex flex-wrap justify-end gap-x-1">
                <span className="text-foreground">{fee}</span>
                <span>· {cost(feeAmount)}</span>
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  )
}
