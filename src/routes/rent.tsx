import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useSolanaClient, useWalletSession } from '@solana/react-hooks'
import { Wallet } from 'lucide-react'
import type { OwnedMarketInterval } from '@/features/trading/api/rent-accounts'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { shortenAddress } from '@/features/trading/lib/format'
import { tradingQueries } from '@/features/trading/queries'

export const Route = createFileRoute('/rent')({
  component: RentPage,
})

type AccountRow = {
  address: string
  index: bigint
  market: string
  openPositions?: number
  payer: string
}

function mapIntervalRows(
  accounts: Array<OwnedMarketInterval>,
): Array<AccountRow> {
  return accounts.map((account) => ({
    address: account.address.toString(),
    index: account.data.index,
    market: account.data.market.toString(),
    openPositions: account.data.openPositions,
    payer: account.data.payer.toString(),
  }))
}

function RentPage() {
  const client = useSolanaClient()
  const session = useWalletSession()
  const ownerAddress = session?.account.address.toString() ?? null

  const intervalsQuery = useQuery({
    ...tradingQueries.ownedMarketIntervals({ authority: ownerAddress, client }),
    enabled: Boolean(ownerAddress),
  })
  const intervalRows = mapIntervalRows(intervalsQuery.data ?? [])
  const totalAccounts = intervalRows.length
  const isLoading = ownerAddress !== null && intervalsQuery.isPending
  const isRefreshing = ownerAddress !== null && intervalsQuery.isFetching
  const errorMessage =
    intervalsQuery.error instanceof Error ? intervalsQuery.error.message : null

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)] text-foreground">
      <div className="relative mx-auto max-w-[1800px] px-4 pb-12 pt-8 min-[601px]:px-6 min-[769px]:px-10 min-[1441px]:px-20">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-normal tracking-tight">Rent accounts</h1>
          <Badge
            className="rounded-full border-border bg-secondary text-muted-foreground"
            variant="muted"
          >
            Wallet funded
          </Badge>
        </div>

        <p className="mb-8 max-w-2xl text-sm leading-6 text-muted-foreground">
          View the market interval accounts funded by your wallet. Once an
          interval is no longer in use, you can close it to reclaim its SOL rent
          from the wallet menu.
        </p>

        {!ownerAddress ? (
          <Alert className="mb-6 rounded-[20px] border-border bg-[var(--panel)] p-6 text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                <Wallet className="size-4" />
              </span>
              <span>Connect a wallet to load owned rent accounts.</span>
            </div>
          </Alert>
        ) : (
          <>
            <div className="mb-6 grid gap-3">
              <Card className="rounded-[20px] border-border bg-[var(--panel)] shadow-(--ring-panel)">
                <CardContent className="space-y-3 p-5">
                  <p className="text-xs text-muted-foreground">
                    Total accounts
                  </p>
                  <p className="text-2xl font-normal tabular-nums leading-none">
                    {totalAccounts}
                  </p>
                </CardContent>
              </Card>
            </div>

            {isRefreshing && !isLoading ? (
              <p className="mb-4 text-xs text-muted-foreground">
                Refreshing account list...
              </p>
            ) : null}

            {errorMessage ? (
              <Alert className="mb-6 rounded-[20px] border-destructive/20 bg-destructive/5 text-destructive">
                {errorMessage}
              </Alert>
            ) : null}

            <div className="grid gap-6">
              <OwnedAccountCard
                description="Market intervals funded by this wallet, holding settlement snapshots and scheduled exits."
                emptyLabel="No funded market intervals found."
                isLoading={isLoading}
                rows={intervalRows}
                showOpenPositions
                title="Market intervals"
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function OwnedAccountCard({
  description,
  emptyLabel,
  isLoading,
  rows,
  showOpenPositions = false,
  title,
}: {
  description: string
  emptyLabel: string
  isLoading: boolean
  rows: Array<AccountRow>
  showOpenPositions?: boolean
  title: string
}) {
  return (
    <Card className="min-w-0 rounded-[20px] border-border bg-[var(--panel)] shadow-(--ring-panel)">
      <CardHeader className="px-5 pt-5">
        <CardTitle className="text-base font-normal">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading accounts...
          </p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="pb-3 pr-3 font-normal">Account</th>
                  <th className="pb-3 pr-3 font-normal">Index</th>
                  <th className="pb-3 pr-3 font-normal">Market</th>
                  {showOpenPositions ? (
                    <th className="pb-3 pr-3 font-normal">Open positions</th>
                  ) : null}
                  <th className="pb-3 font-normal">Payer</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.address}
                    className="border-t border-border text-secondary-foreground"
                  >
                    <td className="py-3 pr-3 font-sans tabular-nums text-xs">
                      <span title={row.address}>
                        {shortenAddress(row.address, 6, 6)}
                      </span>
                    </td>
                    <td className="py-3 pr-3 font-sans tabular-nums text-xs">
                      {row.index.toString()}
                    </td>
                    <td className="py-3 pr-3 font-sans tabular-nums text-xs">
                      <span title={row.market}>
                        {shortenAddress(row.market, 6, 6)}
                      </span>
                    </td>
                    {showOpenPositions ? (
                      <td className="py-3 pr-3 font-sans tabular-nums text-xs">
                        {(row.openPositions ?? 0).toString()}
                      </td>
                    ) : null}
                    <td className="py-3 font-sans tabular-nums text-xs">
                      <span title={row.payer}>
                        {shortenAddress(row.payer, 6, 6)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
