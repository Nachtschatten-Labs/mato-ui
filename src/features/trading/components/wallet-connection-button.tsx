import { useEffect, useId, useRef, useState } from 'react'
import { useWalletConnection } from '@solana/react-hooks'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  HandCoins,
  LogOut,
  Wallet,
} from 'lucide-react'
import {
  MAINTENANCE_TRANSACTION_FEE_BUFFER_ATOMS,
  NATIVE_SOL_DECIMALS,
} from '../constants'
import { useReclaimRent } from '../hooks/use-reclaim-rent'
import { useWalletSolBalance } from '../hooks/use-wallet-sol-balance'
import { isNativeBalanceBelowTransactionMinimum } from '../lib/amounts'
import {
  formatAtoms,
  formatExplorerTransactionUrl,
  shortenAddress,
} from '../lib/format'
import type { MarketId } from '../constants'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { endpoint } from '@/integrations/solana'

interface WalletConnectionButtonProps {
  marketId: MarketId
}

export function WalletConnectionButton({
  marketId,
}: WalletConnectionButtonProps) {
  const {
    connect,
    connected,
    connectors,
    currentConnector,
    disconnect,
    isReady,
    status,
    wallet,
  } = useWalletConnection()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const dropdownId = useId()
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const reclaimRent = useReclaimRent(open && connected, marketId)
  const nativeSolBalance = useWalletSolBalance()

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (dropdownRef.current?.contains(target)) return

      setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (open) return
    reclaimRent.clearFeedback()
  }, [open, reclaimRent.clearFeedback])

  useEffect(() => {
    if (status !== 'error') return

    toast.error('Wallet connection failed', {
      description: 'Try another connector.',
      id: 'wallet-connection-error',
    })
  }, [status])

  useEffect(() => {
    const signature = reclaimRent.signature
    if (reclaimRent.status !== 'success' || !signature) return

    toast.success('Rent reclaimed', {
      action: {
        label: 'View',
        onClick: () => {
          window.open(
            formatExplorerTransactionUrl(signature, endpoint),
            '_blank',
            'noopener,noreferrer',
          )
        },
      },
      description: `Reclaimed ${formatAtoms(
        reclaimRent.reclaimedLamports,
        9,
      )} SOL.`,
      id: `reclaim-rent-success-${signature}`,
    })
  }, [reclaimRent.reclaimedLamports, reclaimRent.signature, reclaimRent.status])

  useEffect(() => {
    if (!reclaimRent.error) return

    toast.error('Rent reclaim failed', {
      description: reclaimRent.error,
      id: 'reclaim-rent-error',
    })
  }, [reclaimRent.error])

  if (!isReady) {
    return (
      <Button
        size="lg"
        variant="outline"
        disabled
        className="h-9 justify-center gap-2 rounded-full border-white/6 bg-card px-4 text-[12px] font-normal shadow-none"
      >
        <Wallet className="size-3.5" />
        <span className="text-muted-foreground">Loading wallets</span>
      </Button>
    )
  }

  const address = wallet?.account.address.toString() ?? null
  const hasLowReclaimRentNativeSolBalance =
    connected &&
    isNativeBalanceBelowTransactionMinimum(
      nativeSolBalance.lamports,
      MAINTENANCE_TRANSACTION_FEE_BUFFER_ATOMS,
    )
  const reclaimRentNativeSolWarning = hasLowReclaimRentNativeSolBalance
    ? `Your wallet has ${formatAtoms(
        nativeSolBalance.lamports ?? 0n,
        NATIVE_SOL_DECIMALS,
      )} SOL. Add SOL before reclaiming rent; at least ${formatAtoms(
        MAINTENANCE_TRANSACTION_FEE_BUFFER_ATOMS,
        NATIVE_SOL_DECIMALS,
      )} SOL is required for fees.`
    : null

  const handleCopyAddress = async () => {
    if (!address) return

    await navigator.clipboard.writeText(address)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_500)
  }

  const showReclaimRentButton = connected && reclaimRent.closeableCount > 0
  const handleReclaimRent = async () => {
    if (reclaimRentNativeSolWarning) {
      toast.warning('Not enough SOL', {
        description: reclaimRentNativeSolWarning,
        id: 'reclaim-rent-validation',
      })
      return
    }

    const success = await reclaimRent.reclaimRent()
    if (success) {
      await nativeSolBalance.refresh()
    }
  }

  return (
    <div ref={dropdownRef} className="relative z-[70]">
      <Button
        size="lg"
        variant="outline"
        aria-controls={open ? dropdownId : undefined}
        aria-expanded={open}
        className="h-9 max-w-full justify-between gap-3 rounded-full border-white/6 bg-card px-4 text-[12px] font-normal shadow-none hover:bg-secondary"
        onClick={() => setOpen((previous) => !previous)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Wallet className="size-3.5 text-muted-foreground" />
          <span className="truncate">
            {connected ? shortenAddress(address, 4, 4) : 'Connect wallet'}
          </span>
        </span>
        <ChevronDown
          className={`size-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </Button>

      {open ? (
        <Card
          id={dropdownId}
          className="absolute right-0 z-[80] mt-3 w-[19rem] max-w-[calc(100vw-2.5rem)] rounded-2xl border-white/6 bg-card shadow-[0_24px_80px_-24px_rgba(0,0,0,0.75)]"
        >
          <CardContent className="space-y-3 p-4">
            {connected ? (
              <>
                <div className="max-w-full rounded-xl bg-secondary p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-positive" />
                      Connected
                    </span>
                    {currentConnector ? (
                      <span className="text-xs text-muted-foreground">
                        {currentConnector.name}
                      </span>
                    ) : null}
                  </div>
                  <button
                    aria-label={
                      copied ? 'Address copied' : 'Copy wallet address'
                    }
                    className="flex max-w-full items-center gap-2 rounded-sm text-left text-sm leading-6 text-foreground transition-colors outline-none hover:text-[color:var(--color-accent-strong)] focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                      void handleCopyAddress()
                    }}
                    type="button"
                  >
                    {copied ? (
                      <Check className="size-4 shrink-0" />
                    ) : (
                      <Copy className="size-4 shrink-0" />
                    )}
                    <span className="truncate">
                      {shortenAddress(address, 4, 4)}
                    </span>
                  </button>
                </div>
                {showReclaimRentButton ? (
                  <>
                    <Button
                      className="w-full justify-between rounded-xl"
                      disabled={reclaimRent.isReclaiming}
                      variant="outline"
                      onClick={() => {
                        void handleReclaimRent()
                      }}
                    >
                      {reclaimRent.isReclaiming
                        ? 'Reclaiming rent...'
                        : 'Reclaim Rent'}
                      <HandCoins className="size-4" />
                    </Button>
                    {reclaimRentNativeSolWarning ? (
                      <div className="flex items-start gap-2 rounded-xl border border-warning/35 bg-warning/10 px-3 py-2 text-xs leading-5 text-warning-foreground">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        <span>{reclaimRentNativeSolWarning}</span>
                      </div>
                    ) : null}
                  </>
                ) : null}
                <Button
                  className="w-full justify-between rounded-xl"
                  variant="outline"
                  onClick={() => {
                    reclaimRent.reset()
                    void disconnect()
                    setOpen(false)
                  }}
                >
                  Disconnect
                  <LogOut className="size-4" />
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Connect a wallet</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {connectors.length > 0
                      ? 'Choose your wallet to start trading.'
                      : 'Open your wallet browser extension, then refresh to connect.'}
                  </p>
                </div>
                <div className="space-y-2">
                  {connectors.map((connector) => (
                    <Button
                      key={connector.id}
                      className="w-full justify-between rounded-xl"
                      variant="outline"
                      onClick={() => {
                        void connect(connector.id, { autoConnect: true })
                        setOpen(false)
                      }}
                    >
                      {connector.name}
                      <span className="text-xs text-muted-foreground">
                        Connect
                      </span>
                    </Button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
