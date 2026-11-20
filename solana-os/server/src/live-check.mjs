import {
  durationSlots,
  impactPercent,
  parseAtoms,
  priceNumber,
  scaledFlowFor,
} from './clearing.mjs'
import { DEFAULT_READ_API_URL } from './constants.mjs'
import { fetchMarket } from './market.mjs'

const readApiUrl = process.env.MATO_READ_API_URL || DEFAULT_READ_API_URL
const market = await fetchMarket(readApiUrl)
const fromFlows = priceNumber(market.baseFlow, market.quoteFlow)
const reported = market.reportedPrice
const gap =
  fromFlows && reported ? Math.abs(fromFlows - reported) / reported : null

console.log(
  JSON.stringify(
    {
      eventTime: market.eventTime,
      flowPrice: fromFlows,
      readApi: readApiUrl,
      reportedPrice: reported,
      relativeGap: gap,
      slot: market.slot,
    },
    null,
    2,
  ),
)

const amount = parseAtoms('100', 6)
const slots = durationSlots(60)
const scaled = scaledFlowFor(amount, slots)
const impact = impactPercent({
  baseFlow: market.baseFlow,
  quoteFlow: market.quoteFlow,
  scaledFlow: scaled,
  side: 'buy',
})
console.log(
  `A 100 USDC buy streamed over 60s would move the paper price by ${impact?.toFixed(4)}%.`,
)

if (gap === null || gap > 1e-6) {
  process.exitCode = 1
}
