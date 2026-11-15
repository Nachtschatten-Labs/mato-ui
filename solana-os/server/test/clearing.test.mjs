import assert from 'node:assert/strict'
import test from 'node:test'
import { FLOW_PRECISION } from '../src/constants.mjs'
import {
  durationSlots,
  fillForSlots,
  formatImpact,
  formatPrice,
  impactPercent,
  netOutput,
  parseAtoms,
  priceNumber,
  scaledFlowFor,
  tradeFeeAtoms,
} from '../src/clearing.mjs'
import { parseMarketPayload } from '../src/market.mjs'
import { MARKET_ADDRESS } from '../src/constants.mjs'

const LIVE = {
  price: {
    event_time: '2026-11-15T20:14:29.791Z',
    market_address: MARKET_ADDRESS,
    price: 71.23096018270826,
    slot: 469859683,
  },
  updates: {
    items: [
      {
        base_flow: '22622575280000000000',
        created_at: '2026-11-15T20:14:29.791Z',
        market_address: MARKET_ADDRESS,
        quote_flow: '1611427759000000000',
        slot: 469859683,
      },
    ],
  },
}

test('live Mato flows price the same way the read API does', () => {
  const market = parseMarketPayload(LIVE.price, LIVE.updates, 0)
  const price = priceNumber(market.baseFlow, market.quoteFlow)
  assert.ok(Math.abs(price - LIVE.price.price) / LIVE.price.price < 1e-9)
  assert.equal(formatPrice(market.baseFlow, market.quoteFlow), '71.23')
})

test('one slot of bookkeeping matches the program truncation', () => {
  const scaledFlow = 100_000_000_000_000n
  const outputFlow = 2_000_000_000_000_000_000n
  const inputFlow = 1_000_000_000_000_000_000n
  assert.equal(
    fillForSlots({ inputFlow, outputFlow, scaledFlow, slots: 1 }),
    200_000n,
  )
})

test('buy impact matches the UI formula when duration is not haircut', () => {
  const amountAtoms = 100_000_000n
  const slots = durationSlots(60)
  const marketFlow = 1_611_427_759_000_000_000n
  const scaled = scaledFlowFor(amountAtoms, slots)
  const ours = impactPercent({
    baseFlow: 1n,
    quoteFlow: marketFlow,
    scaledFlow: scaled,
    side: 'buy',
  })
  const amountFlowTwice = amountAtoms * FLOW_PRECISION * 2n
  const effective = BigInt(slots) * 2n
  const ui = (Number(amountFlowTwice) / Number(marketFlow * effective)) * 100
  assert.ok(Math.abs(ours - ui) < 1e-9)
  assert.match(formatImpact('buy', ours), /^\+0\.\d\d%$/)
})

test('fee rounds up and net output never goes backwards', () => {
  assert.equal(tradeFeeAtoms(1n, 10), 1n)
  assert.equal(tradeFeeAtoms(1000n, 10), 1n)
  let previous = 0n
  for (let gross = 0n; gross <= 5_000n; gross += 1n) {
    const net = netOutput(gross, 10)
    assert.ok(net >= previous)
    previous = net
  }
})

test('atom parser keeps USDC and SOL scales', () => {
  assert.equal(parseAtoms('100.5', 6), 100_500_000n)
  assert.equal(parseAtoms('0.5', 9), 500_000_000n)
  assert.equal(parseAtoms('10', 9), 10_000_000_000n)
  assert.equal(parseAtoms('0.0000001', 6), null)
  assert.equal(parseAtoms('-1', 6), null)
})
