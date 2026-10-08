import { durationToSlots } from './amounts'
import { computePriceImpactPercent } from './price-impact'
import type { PriceImpactInputs } from './price-impact'

export interface DurationQuoteInputs extends PriceImpactInputs {
  amountUiValue: number | null
  durationSeconds: number | null
  indicativePrice: number | null
}

/** Uses current market flows for the same conservative estimate at any duration. */
export function getDurationQuote({
  amountAtoms,
  amountUiValue,
  durationSeconds,
  indicativePrice,
  side,
  streamingState,
}: DurationQuoteInputs) {
  const priceImpactPercent =
    durationSeconds === null ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
      ? null
      : computePriceImpactPercent({
          amountAtoms,
          durationSlots: durationToSlots(durationSeconds),
          side,
          streamingState,
        })

  const executionPrice = (() => {
    if (
      indicativePrice === null ||
      !Number.isFinite(indicativePrice) ||
      indicativePrice <= 0
    ) {
      return null
    }
    // Do not show the unimpacted rate as a quote when liquidity is unavailable.
    if (amountAtoms !== null && amountAtoms > 0n && priceImpactPercent === null)
      return null
    if (priceImpactPercent === null) return indicativePrice

    const signedImpact =
      side === 'buy' ? priceImpactPercent : -priceImpactPercent
    const nextPrice = indicativePrice * (1 + signedImpact / 100)
    return Number.isFinite(nextPrice) && nextPrice > 0 ? nextPrice : null
  })()

  const receiveAmount = (() => {
    if (
      amountUiValue === null ||
      !Number.isFinite(amountUiValue) ||
      amountUiValue <= 0 ||
      executionPrice === null
    ) {
      return null
    }
    const amount =
      side === 'buy'
        ? amountUiValue / executionPrice
        : amountUiValue * executionPrice
    return Number.isFinite(amount) ? amount : null
  })()

  return { priceImpactPercent, executionPrice, receiveAmount }
}
