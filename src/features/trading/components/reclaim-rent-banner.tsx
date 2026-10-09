import { AlertTriangle, HandCoins } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export function ReclaimRentBanner({
  closeableCount,
  isReclaiming,
  nativeSolWarning,
  onReclaim,
}: {
  closeableCount: number
  isReclaiming: boolean
  nativeSolWarning: string | null
  onReclaim: () => void
}) {
  if (closeableCount <= 0) return null

  const accountLabel = closeableCount === 1 ? 'account' : 'accounts'

  return (
    <Alert className="mb-5 rounded-[var(--r-panel)] border-0 bg-[var(--panel)] p-4 text-muted-foreground shadow-[var(--ring-panel)] backdrop-blur-[24px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
            <HandCoins className="size-4.5" />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-foreground">
              Rent is ready to reclaim
            </p>
            <p className="text-xs leading-5">
              Close {closeableCount} stale market {accountLabel} and return the
              rent to your wallet.
            </p>
            {nativeSolWarning ? (
              <p className="flex items-start gap-2 text-xs leading-5 text-warning">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>{nativeSolWarning}</span>
              </p>
            ) : null}
          </div>
        </div>
        <Button
          aria-busy={isReclaiming}
          className="h-9 w-full rounded-full border-border bg-transparent px-4 text-xs sm:w-auto"
          disabled={isReclaiming}
          onClick={onReclaim}
          variant="outline"
        >
          {isReclaiming ? 'Reclaiming...' : 'Reclaim rent'}
          <HandCoins className="size-4" />
        </Button>
      </div>
    </Alert>
  )
}
