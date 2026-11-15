import {
  BOOKKEEPING_PRECISION,
  FLOW_PART_ONE,
  FLOW_PART_TWO,
  FLOW_PRECISION,
  MAX_U128,
  PRICE_SCALE,
  SLOT_MS,
} from './constants.mjs'

/**
 * Mato clears every 200ms. The published market update carries aggregate
 * base_flow and quote_flow in the same scaled units as a position's `flow`
 * (token atoms per slot, times 1e9). The UI price is
 * abs(quote_flow / base_flow) * 10^(baseDecimals - quoteDecimals).
 * See src/features/trading/lib/market.ts `marketPriceFromFlows`.
 *
 * A stream deposits an amount and adds a constant per-slot flow for its
 * duration. Buys add quote flow, sells add base flow. The shared clearing
 * price is the ratio after every overlapping stream is included. Output per
 * slot follows the program's bookkeeping truncation in
 * src/features/trading/lib/position-progress.ts and settlement-snapshot.ts.
 * The fee is rounded up on gross output, matching `tradeFeeAtoms`.
 */

export function durationSlots(seconds) {
  return Math.max(1, Math.round(seconds / (SLOT_MS / 1000)))
}

export function parseAtoms(raw, decimals) {
  const text = typeof raw === 'number' ? String(raw) : raw
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null
  const [whole, frac = ''] = trimmed.split('.')
  if (whole.length > 12 || frac.length > decimals) return null
  const digits = `${whole}${frac.padEnd(decimals, '0')}`
  const atoms = BigInt(digits)
  return atoms > 0n ? atoms : null
}

export function scaledFlowFor(amountAtoms, slots) {
  if (slots <= 0 || amountAtoms <= 0n) return 0n
  return (amountAtoms * FLOW_PRECISION) / BigInt(slots)
}

export function consumedAtoms(scaledFlow, slots) {
  if (slots <= 0 || scaledFlow <= 0n) return 0n
  return (scaledFlow * BigInt(slots)) / FLOW_PRECISION
}

export function calculateSwappedAmount(flow, accumulatedPrices) {
  const scaledFlow = flow / FLOW_PART_ONE
  if (scaledFlow === 0n || accumulatedPrices <= MAX_U128 / scaledFlow) {
    return (
      (scaledFlow * accumulatedPrices) / BOOKKEEPING_PRECISION / FLOW_PART_TWO
    )
  }
  return ((flow / FLOW_PRECISION) * accumulatedPrices) / BOOKKEEPING_PRECISION
}

function perSlotBook(outputFlow, inputFlow) {
  if (outputFlow <= 0n || inputFlow <= 0n) return 0n
  if (outputFlow >= MAX_U128 / BOOKKEEPING_PRECISION) {
    return (
      (((BOOKKEEPING_PRECISION / FLOW_PRECISION) * outputFlow) / inputFlow) *
      FLOW_PRECISION
    )
  }
  return (BOOKKEEPING_PRECISION * outputFlow) / inputFlow
}

export function fillForSlots({ scaledFlow, outputFlow, inputFlow, slots }) {
  if (slots <= 0 || scaledFlow <= 0n) return 0n
  const perSlot = perSlotBook(outputFlow, inputFlow)
  if (perSlot <= 0n) return 0n
  return calculateSwappedAmount(scaledFlow, perSlot * BigInt(slots))
}

export function tradeFeeAtoms(amount, feeBps) {
  if (amount <= 0n || feeBps <= 0) return 0n
  return (amount * BigInt(feeBps) + 9_999n) / 10_000n
}

export function netOutput(gross, feeBps) {
  if (gross <= 0n) return 0n
  const fee = tradeFeeAtoms(gross, feeBps)
  return gross > fee ? gross - fee : 0n
}

export function aggregateFlows(live, orders) {
  let buy = 0n
  let sell = 0n
  for (const order of orders) {
    if (order.side === 'buy') buy += order.scaledFlow
    else sell += order.scaledFlow
  }
  return {
    baseFlow: live.baseFlow + sell,
    quoteFlow: live.quoteFlow + buy,
  }
}

export function impactPercent({ side, scaledFlow, baseFlow, quoteFlow }) {
  if (scaledFlow <= 0n || baseFlow <= 0n || quoteFlow <= 0n) return null
  if (side === 'buy') return (Number(scaledFlow) / Number(quoteFlow)) * 100
  return (Number(scaledFlow) / Number(baseFlow + scaledFlow)) * 100
}

export function executionFlows(side, baseFlow, quoteFlow, scaledFlow) {
  return {
    baseFlow: side === 'sell' ? baseFlow + scaledFlow : baseFlow,
    quoteFlow: side === 'buy' ? quoteFlow + scaledFlow : quoteFlow,
  }
}

export function markQuoteAtoms(solAtoms, baseFlow, quoteFlow) {
  if (solAtoms <= 0n || baseFlow <= 0n || quoteFlow <= 0n) {
    return solAtoms <= 0n ? 0n : null
  }
  return (solAtoms * quoteFlow) / baseFlow
}

export function priceNumber(baseFlow, quoteFlow) {
  if (baseFlow <= 0n || quoteFlow <= 0n) return null
  return (Number(quoteFlow) / Number(baseFlow)) * Number(PRICE_SCALE)
}

export function formatUnits(atoms, decimals, places, { sign = false } = {}) {
  const negative = atoms < 0n
  let value = negative ? -atoms : atoms
  const shift = decimals - places
  const step = 10n ** BigInt(shift)
  value = (value + step / 2n) / step
  const shown = 10n ** BigInt(places)
  const whole = value / shown
  const frac = (value % shown).toString().padStart(places, '0')
  const body = places > 0 ? `${whole}.${frac}` : `${whole}`
  if (negative) return `-${body}`
  if (sign && value !== 0n) return `+${body}`
  if (sign) return `+${body}`
  return body
}

export function priceCents(baseFlow, quoteFlow) {
  if (baseFlow <= 0n || quoteFlow <= 0n) return null
  return (quoteFlow * 100_000n + baseFlow / 2n) / baseFlow
}

export function formatPrice(baseFlow, quoteFlow) {
  return formatPricePlaces(baseFlow, quoteFlow, 2)
}

export function formatPricePlaces(baseFlow, quoteFlow, places) {
  if (baseFlow <= 0n || quoteFlow <= 0n) return '--'
  const scale = 10n ** BigInt(places)
  const scaled = (quoteFlow * 1000n * scale + baseFlow / 2n) / baseFlow
  const whole = scaled / scale
  const frac = (scaled % scale).toString().padStart(places, '0')
  return `${whole}.${frac}`
}

export function formatCents(cents) {
  if (cents == null) return '--'
  const n = typeof cents === 'bigint' ? cents : BigInt(Math.round(cents))
  if (n < 0n) return `--`
  const whole = n / 100n
  const frac = (n % 100n).toString().padStart(2, '0')
  return `${whole}.${frac}`
}

export function formatImpact(side, percent) {
  if (percent === null || !Number.isFinite(percent)) return '--'
  const signed = side === 'buy' ? percent : -percent
  const text = `${Math.abs(signed).toFixed(4)}%`
  return signed < 0 ? `-${text}` : `+${text}`
}

export function formatDuration(seconds) {
  if (seconds % 60 === 0) return `${seconds / 60}m`
  return `${seconds}s`
}

export function secondsLeft(slotsLeft) {
  return Math.max(0, Math.ceil((slotsLeft * SLOT_MS) / 1000))
}
