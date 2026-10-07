import { getConservativePriceImpactInputs } from './price-impact'
import type { PriceImpactInputs } from './price-impact'

export const MIN_DURATION_SLOTS = 25
export const SLOTS_PER_MINUTE = 150
// The program accepts at most 160,000,000 slots; keep the minute-sized grid.
export const MAX_DURATION_SLOTS =
  Math.floor(160_000_000 / SLOTS_PER_MINUTE) * SLOTS_PER_MINUTE

export function recommendDurationSlots(
  inputs: PriceImpactInputs,
): number | null {
  const conservativeInputs = getConservativePriceImpactInputs(inputs)
  if (
    !conservativeInputs ||
    !inputs.streamingState ||
    inputs.streamingState.marketBaseFlow <= 0n ||
    inputs.streamingState.marketQuoteFlow <= 0n
  ) {
    return null
  }

  const { amountFlowTwice, endSlotInterval, marketFlow } = conservativeInputs
  // Impact must be strictly below 1/10,000. For sells, the added user flow
  // is part of the denominator, reducing the threshold multiplier by one.
  const thresholdMultiplier = inputs.side === 'buy' ? 10_000n : 9_999n
  const shortestSlots =
    (thresholdMultiplier * amountFlowTwice + marketFlow * endSlotInterval) /
      (marketFlow * 2n) +
    1n
  const boundedSlots =
    shortestSlots < BigInt(MIN_DURATION_SLOTS)
      ? BigInt(MIN_DURATION_SLOTS)
      : shortestSlots
  const minuteSlots = BigInt(SLOTS_PER_MINUTE)
  const recommendedSlots =
    boundedSlots <= minuteSlots
      ? boundedSlots
      : ((boundedSlots + minuteSlots - 1n) / minuteSlots) * minuteSlots

  // The program requires at least one input atom per slot. Its end-slot
  // rounding can extend the duration by floor(interval / 2), so only suggest
  // durations that keep enough flow even at that longest possible endpoint.
  const longestDuration = recommendedSlots + endSlotInterval / 2n
  if (
    recommendedSlots > BigInt(MAX_DURATION_SLOTS) ||
    (inputs.amountAtoms ?? 0n) < longestDuration
  ) {
    return null
  }

  return Number(recommendedSlots)
}
