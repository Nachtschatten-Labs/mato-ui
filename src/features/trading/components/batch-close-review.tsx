import { useRef, useState } from 'react'
import { useSolanaClient, useWalletSession } from '@solana/react-hooks'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { fetchClosePositionsPreview } from '../api/close-position-preview'
import { formatAtoms, shortenAddress } from '../lib/format'
import { isBuyTradePosition } from '../lib/trade-position'
import type { Address } from '@solana/kit'
import type { TradePositionRecord } from '../domain/models'

export function BatchCloseReview({
  positions,
  marketAddress,
  baseTicker,
  quoteTicker,
  baseDecimals,
  quoteDecimals,
  onDismiss,
  onConfirm,
  isPending,
}: {
  positions: TradePositionRecord[]
  marketAddress: Address
  baseTicker: string
  quoteTicker: string
  baseDecimals: number
  quoteDecimals: number
  onDismiss: () => void
  onConfirm: () => Promise<boolean>
  isPending: boolean
}) {
  const client = useSolanaClient()
  const session = useWalletSession()
  const authority = session?.account.address
  const [confirming, setConfirming] = useState(false)
  const [failed, setFailed] = useState(false)
  const pendingRef = useRef(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const busy = confirming || isPending
  const previews = useQuery({
    queryKey: [
      'trading',
      'batch-close-preview',
      marketAddress,
      authority,
      positions.map((position) => position.address),
    ],
    enabled: Boolean(authority) && !busy,
    staleTime: 3_000,
    refetchInterval: busy ? false : 10_000,
    retry: 1,
    queryFn: ({ signal }) =>
      fetchClosePositionsPreview({
        client,
        marketAddress,
        positionAddresses: positions.map((position) => position.address),
        authority: authority!,
        signal,
      }),
  })
  async function confirm() {
    if (
      pendingRef.current ||
      busy ||
      !previews.data ||
      previews.isFetching ||
      previews.isError
    )
      return
    if (
      previews.data.some(
        (preview) => Date.now() - preview.simulatedAtMs > 15_000,
      )
    ) {
      void previews.refetch()
      return
    }
    pendingRef.current = true
    setConfirming(true)
    setFailed(false)
    try {
      if (await onConfirm()) onDismiss()
      else setFailed(true)
    } catch {
      setFailed(true)
    } finally {
      pendingRef.current = false
      setConfirming(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onDismiss()
      }}
    >
      <DialogContent initialFocus={cancelRef} showCloseButton={!busy}>
        <div>
          <DialogTitle>Close {positions.length} streams?</DialogTitle>
          <DialogDescription className="mt-2">
            These streams will end permanently. They can’t be resumed.
          </DialogDescription>
        </div>
        <div className="space-y-3">
          <p className="text-xs font-medium">You’ll get back</p>
          {previews.isLoading && (
            <p role="status" className="text-xs text-muted-foreground">
              Calculating your returns…
            </p>
          )}
          {previews.data?.map((preview, index) => {
            const position = positions[index]
            const buy = isBuyTradePosition(position.data)
            const inputToken = buy ? quoteTicker : baseTicker,
              outputToken = buy ? baseTicker : quoteTicker
            const inputDecimals = buy ? quoteDecimals : baseDecimals,
              outputDecimals = buy ? baseDecimals : quoteDecimals
            return (
              <div
                key={position.address}
                className="space-y-2 rounded-lg border border-border/60 bg-secondary/40 p-3 text-xs"
              >
                <p className="text-muted-foreground">
                  {inputToken} → {outputToken} ·{' '}
                  {shortenAddress(position.address)}
                </p>
                <p className="flex justify-between gap-2">
                  <span>Received, after fee</span>
                  <span className="break-all text-right font-mono">
                    {formatAtoms(
                      preview.receivedAtoms,
                      outputDecimals,
                      outputDecimals,
                    )}{' '}
                    {outputToken}
                  </span>
                </p>
                <p className="flex justify-between gap-2">
                  <span>Unspent deposit</span>
                  <span className="break-all text-right font-mono">
                    {formatAtoms(
                      preview.remainingDepositAtoms,
                      inputDecimals,
                      inputDecimals,
                    )}{' '}
                    {inputToken}
                  </span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Fee included:{' '}
                  {formatAtoms(
                    preview.feeAtoms,
                    outputDecimals,
                    outputDecimals,
                  )}{' '}
                  {outputToken}. Position rent returned:{' '}
                  {formatAtoms(preview.positionRentLamports, 9, 9)} SOL.
                </p>
                {(preview.baseReceiver !== authority ||
                  preview.quoteReceiver !== authority ||
                  preview.rentReceiver !== authority) && (
                  <p className="text-[10px] text-muted-foreground">
                    {baseTicker} to {shortenAddress(preview.baseReceiver)} ·{' '}
                    {quoteTicker} to {shortenAddress(preview.quoteReceiver)} ·
                    rent to {shortenAddress(preview.rentReceiver)}
                  </p>
                )}
              </div>
            )
          })}
          {(previews.isError || failed) && (
            <p role="alert" className="text-xs text-negative">
              {failed
                ? 'The streams were not closed.'
                : 'Could not calculate your returns.'}{' '}
              <button
                type="button"
                disabled={previews.isFetching || busy}
                onClick={() => {
                  setFailed(false)
                  void previews.refetch()
                }}
                className="cursor-pointer underline"
              >
                Refresh preview
              </button>
            </p>
          )}
          <p className="text-[10px] leading-4 text-muted-foreground">
            Amounts may change until confirmed. Network fees and any
            token-account rent are separate.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            aria-busy={busy}
            disabled={
              busy || previews.isFetching || previews.isError || !previews.data
            }
            onClick={() => void confirm()}
          >
            {busy ? 'Closing…' : 'Close streams'}
          </Button>
          <Button
            ref={cancelRef}
            variant="outline"
            disabled={busy}
            onClick={onDismiss}
          >
            Keep streams
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
