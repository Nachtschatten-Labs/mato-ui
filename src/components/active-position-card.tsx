import { ArrowRight } from 'lucide-react'
import { SLOT_DURATION_MS } from '@/features/trading/constants'
import type { ActivePositionProps } from '@/lib/types/position'

function formatAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals)
  const whole = amount / divisor
  const fraction = amount % divisor
  const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 4)
  return `${whole}.${fractionStr}`
}

function formatTime(slots: bigint): string {
  const ms = Number(slots) * SLOT_DURATION_MS
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `~${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `~${minutes}m`
  }
  return `~${seconds}s`
}

export default function ActivePositionCard({
  position,
  currentSlot,
  inputMint,
  outputMint,
  amountReceived,
}: ActivePositionProps) {
  const totalSlots = position.endSlot - position.startSlot
  const elapsedSlots =
    currentSlot > position.startSlot
      ? currentSlot < position.endSlot
        ? currentSlot - position.startSlot
        : totalSlots
      : BigInt(0)
  const remainingSlots = totalSlots - elapsedSlots

  const progress =
    totalSlots > 0 ? Number((elapsedSlots * BigInt(100)) / totalSlots) : 0

  const amountSpent = (position.amount * elapsedSlots) / totalSlots
  const amountRemaining = position.amount - amountSpent
  const ratePerSlot = totalSlots > 0 ? position.amount / totalSlots : BigInt(0)

  return (
    <div className="bg-[var(--panel)] rounded-lg p-4 shadow-(--ring-panel)">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg font-normal text-foreground">
          {inputMint.symbol}
        </span>
        <ArrowRight size={20} className="text-muted-foreground" />
        <span className="text-lg font-normal text-foreground">
          {outputMint.symbol}
        </span>
        <span className="ml-auto text-sm text-muted-foreground">
          {position.isBuy ? 'Buy' : 'Sell'}
        </span>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm text-muted-foreground mb-1">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-[var(--track)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--action)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-background shadow-(--sunk) rounded-lg p-3">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-foreground font-normal">
            {formatAmount(position.amount, inputMint.decimals)}{' '}
            {inputMint.symbol}
          </div>
        </div>
        <div className="bg-background shadow-(--sunk) rounded-lg p-3">
          <div className="text-xs text-muted-foreground">
            {' '}
            {position.isBuy ? 'Spent' : 'Sold'}
          </div>
          <div className="text-foreground font-normal">
            {formatAmount(amountSpent, inputMint.decimals)} {inputMint.symbol}
          </div>
        </div>
        <div className="bg-background shadow-(--sunk) rounded-lg p-3">
          <div className="text-xs text-muted-foreground">Remaining</div>
          <div className="text-foreground font-normal">
            {formatAmount(amountRemaining, inputMint.decimals)}{' '}
            {inputMint.symbol}
          </div>
        </div>
        {amountReceived !== undefined && (
          <div className="bg-background shadow-(--sunk) rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Received</div>
            <div className="text-[var(--action)] font-normal">
              {formatAmount(amountReceived, outputMint.decimals)}{' '}
              {outputMint.symbol}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between text-sm text-muted-foreground">
        <div>
          <span className="text-[var(--t4)]">Slots: </span>
          {elapsedSlots.toString()} / {totalSlots.toString()}
        </div>
        <div>
          <span className="text-[var(--t4)]">Flow: </span>
          {formatAmount(ratePerSlot, inputMint.decimals)} SOL/slot
        </div>
      </div>
      <div className="text-sm text-muted-foreground mt-1">
        <span className="text-[var(--t4)]">Est. remaining: </span>
        {formatTime(remainingSlots)}
      </div>
    </div>
  )
}
