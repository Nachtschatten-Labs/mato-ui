import { useRef } from 'react'
import { Popover } from '@base-ui/react/popover'
import { LoaderCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatAtoms, shortenAddress } from '../lib/format'
import { TokenMark } from './token-mark'
import type { ClosePositionPreview } from '../lib/close-position-preview'
import type { PositionProgressMetrics } from '../lib/position-progress'

export function ClosePositionReview({
  open,
  onOpenChange,
  onConfirm,
  onRetry,
  preview,
  metrics,
  isLoading,
  isRefreshing,
  isPending,
  disabled,
  error,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  onRetry: () => void
  preview: ClosePositionPreview | undefined
  metrics: PositionProgressMetrics
  isLoading: boolean
  isRefreshing: boolean
  isPending: boolean
  disabled: boolean
  error: string | null
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const isBuy = metrics.sideLabel === 'Buy'
  const depositReceiver = preview
    ? isBuy
      ? preview.quoteReceiver
      : preview.baseReceiver
    : null
  const receivedReceiver = preview
    ? isBuy
      ? preview.baseReceiver
      : preview.quoteReceiver
    : null
  const format = (amount: bigint, decimals: number) =>
    formatAtoms(amount, decimals, decimals)
  return (
    <Popover.Root
      modal
      open={open}
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next)
      }}
    >
      <Popover.Trigger
        aria-label="Close position"
        title="Close position"
        disabled={disabled}
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground outline-none transition-colors hover:border-negative/30 hover:bg-negative/5 hover:text-negative focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : (
          <X className="size-3.5" />
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-50"
        >
          <Popover.Popup
            initialFocus={cancelRef}
            className="max-h-[var(--available-height)] w-[360px] max-w-[calc(100vw-24px)] origin-[var(--transform-origin)] overflow-y-auto rounded-xl bg-popover p-4 text-popover-foreground shadow-[var(--ring-panel),var(--shadow-pop)] outline-none transition-[opacity,transform] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0"
          >
            <Popover.Title className="text-base font-normal">
              Close this stream?
            </Popover.Title>
            <Popover.Description className="mt-2 text-xs leading-5 text-muted-foreground">
              This ends the stream. It can’t be resumed.
            </Popover.Description>
            <div className="mt-4 rounded-lg bg-secondary p-3.5 shadow-[var(--ring-block)]">
              <p className="mb-3 text-xs font-normal">You’ll get back</p>
              {isLoading && !preview ? (
                <p
                  role="status"
                  className="flex items-center gap-2 py-3 text-xs text-muted-foreground"
                >
                  <LoaderCircle className="size-3.5 animate-spin" /> Calculating
                  your returns…
                </p>
              ) : preview ? (
                <div className="space-y-3">
                  <PayoutRow
                    token={metrics.swappedToken}
                    label="Received, after fee"
                    value={format(
                      preview.receivedAtoms,
                      metrics.swappedDecimals,
                    )}
                    receiver={
                      receivedReceiver !== metrics.position.authority
                        ? receivedReceiver
                        : null
                    }
                  />
                  <PayoutRow
                    token={metrics.depositedToken}
                    label="Unspent deposit"
                    value={format(
                      preview.remainingDepositAtoms,
                      metrics.depositedDecimals,
                    )}
                    receiver={
                      depositReceiver !== metrics.position.authority
                        ? depositReceiver
                        : null
                    }
                  />
                  <div className="space-y-1.5 border-t border-border pt-3 text-[10px] text-muted-foreground">
                    <div className="flex justify-between gap-2">
                      <span>Trading fee included</span>
                      <span className="text-right tabular-nums">
                        {format(preview.feeAtoms, metrics.swappedDecimals)}{' '}
                        {metrics.swappedToken}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>Position rent returned</span>
                      <span className="text-right tabular-nums">
                        {format(preview.positionRentLamports, 9)} SOL
                      </span>
                    </div>
                    {preview.rentReceiver !== metrics.position.authority && (
                      <p>
                        Rent goes to {shortenAddress(preview.rentReceiver)}.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  A current preview is required before closing.
                </p>
              )}
            </div>
            {error && (
              <div
                role="alert"
                className="mt-3 text-xs leading-5 text-negative"
              >
                {error}
                <button
                  type="button"
                  disabled={isRefreshing || isPending}
                  onClick={onRetry}
                  className="ml-2 cursor-pointer underline underline-offset-2 disabled:opacity-40"
                >
                  Refresh preview
                </button>
              </div>
            )}
            <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
              {isRefreshing && preview ? 'Updating returns… ' : ''}Amounts may
              change until confirmed. Network fees and any token-account rent
              are separate.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                onClick={onConfirm}
                aria-busy={isPending}
                disabled={
                  disabled ||
                  isPending ||
                  isRefreshing ||
                  !preview ||
                  Boolean(error)
                }
                className="h-9 rounded-lg text-xs"
              >
                {isPending ? 'Closing…' : 'Close stream'}
              </Button>
              <Popover.Close
                ref={cancelRef}
                disabled={isPending}
                render={
                  <Button
                    variant="outline"
                    className="h-9 rounded-lg text-xs"
                  />
                }
              >
                {metrics.isPaused ? 'Keep it paused' : 'Keep it running'}
              </Popover.Close>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function PayoutRow({
  token,
  label,
  value,
  receiver,
}: {
  token: string
  label: string
  value: string
  receiver: string | null
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <TokenMark symbol={token} className="size-6" />
          <div className="min-w-0">
            <p className="text-xs">{token}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
          </div>
        </div>
        <span className="max-w-[55%] break-all text-right tabular-nums text-[13px]">
          {value}
        </span>
      </div>
      {receiver && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          To {shortenAddress(receiver)}
        </p>
      )}
    </div>
  )
}
