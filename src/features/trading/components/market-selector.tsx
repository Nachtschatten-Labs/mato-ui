import { ChevronDown } from 'lucide-react'
import { getMarketDefinition, MARKET_DEFINITIONS } from '../constants'
import { TokenMark } from './token-mark'
import type { MarketId } from '../constants'

export function MarketSelector({
  disabled = false,
  marketId,
  onMarketChange,
}: {
  disabled?: boolean
  marketId: MarketId
  onMarketChange: (marketId: MarketId) => void
}) {
  const market = getMarketDefinition(marketId)

  return (
    <label className="relative inline-flex h-12 shrink-0 items-center gap-3 rounded-full bg-secondary px-4 text-foreground transition-colors hover:bg-muted has-disabled:opacity-50 has-focus-visible:ring-2 has-focus-visible:ring-ring">
      <span aria-hidden="true" className="flex items-center -space-x-2">
        <TokenMark
          symbol={market.baseSymbol}
          className="z-10 size-6 ring-2 ring-secondary"
        />
        <TokenMark
          symbol={market.quoteSymbol}
          className="size-6 ring-2 ring-secondary"
        />
      </span>
      <span
        aria-hidden="true"
        className="text-[17px] font-medium tracking-tight"
      >
        {market.baseSymbol} <span className="text-muted-foreground">/</span>{' '}
        {market.quoteSymbol}
      </span>
      <ChevronDown
        aria-hidden="true"
        className="ml-1 size-3.5 text-muted-foreground"
      />
      <select
        aria-label="Market"
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full opacity-0 disabled:cursor-not-allowed"
        disabled={disabled}
        onChange={(event) => {
          const selectedMarket = MARKET_DEFINITIONS.find(
            (market) => String(market.id) === event.currentTarget.value,
          )
          if (selectedMarket) onMarketChange(selectedMarket.id)
        }}
        value={marketId}
      >
        {MARKET_DEFINITIONS.map((market) => (
          <option key={market.id} value={market.id}>
            {market.baseSymbol}/{market.quoteSymbol} · Market #{market.id}
          </option>
        ))}
      </select>
    </label>
  )
}
