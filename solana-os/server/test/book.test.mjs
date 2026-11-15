import assert from 'node:assert/strict'
import test from 'node:test'
import { createBook } from '../src/book.mjs'
import { START_SOL_ATOMS, START_USDC_ATOMS } from '../src/constants.mjs'
import { netOutput } from '../src/clearing.mjs'

const BASE = 10_000_000_000_000_000_000n
const QUOTE = 1_000_000_000_000_000_000n

function clock() {
  let now = 1_700_000_000_000
  return {
    advance(ms) {
      now += ms
    },
    now: () => now,
    set(value) {
      now = value
    },
  }
}

function openBook(time, flows = { baseFlow: BASE, quoteFlow: QUOTE }) {
  const book = createBook({ now: time.now })
  book.setMarket({ ...flows, fetchedAt: time.now(), slot: 10 }, time.now())
  return book
}

test('a new player opens at zero PnL', () => {
  const time = clock()
  const book = openBook(time)
  const joined = book.hello('7K2Q9M', 'Ada', time.now())
  assert.equal(joined.ok, true)
  assert.equal(joined.snapshot.me.pnl, '+0.00')
  assert.equal(joined.snapshot.me.usdc, '10000.00')
  assert.equal(joined.snapshot.me.sol, '100.0000')
  assert.equal(joined.snapshot.price, '100.00')
  assert.equal(joined.snapshot.feeBps, 2)
})

test('a buy lifts the clearing price and loses to the unimpacted mark', () => {
  const time = clock()
  const book = openBook(time)
  book.hello('buyer', 'Bea', time.now())
  const placed = book.place(
    'buyer',
    { amount: '1000', seconds: 10, side: 'buy' },
    time.now(),
  )
  assert.equal(placed.ok, true)
  const preset = placed.snapshot.presets.find(
    (item) => item.id === 'buy-1000-300',
  )
  assert.equal(placed.snapshot.orders[0].title, 'Buy 1000.00 USDC')
  time.advance(10_000)
  book.setMarket(
    { baseFlow: BASE, fetchedAt: time.now(), quoteFlow: QUOTE, slot: 11 },
    time.now(),
  )
  const player = book.player('buyer')
  const received = player.sol - START_SOL_ATOMS
  const spent = START_USDC_ATOMS - player.usdc
  assert.equal(spent, 1_000_000_000n)
  const noImpact = netOutput(10_000_000_000n, 2)
  assert.ok(received < noImpact)
  assert.ok(received > 9_000_000_000n)
  const view = book.snapshot('buyer', time.now())
  assert.equal(view.orders[0].status, 'done')
  assert.ok(view.me.pnl.startsWith('-'))
  assert.ok(preset)
})

test('an overlapping buy improves the price a seller receives', () => {
  function run(withBuy) {
    const time = clock()
    const book = openBook(time)
    book.hello('seller', 'Sol', time.now())
    if (withBuy) {
      book.hello('buyer', 'Bid', time.now())
      assert.equal(
        book.place(
          'buyer',
          { amount: '10000', seconds: 10, side: 'buy' },
          time.now(),
        ).ok,
        true,
      )
    }
    assert.equal(
      book.place(
        'seller',
        { amount: '1', seconds: 10, side: 'sell' },
        time.now(),
      ).ok,
      true,
    )
    time.advance(10_000)
    book.setMarket(
      { baseFlow: BASE, fetchedAt: time.now(), quoteFlow: QUOTE, slot: 12 },
      time.now(),
    )
    return book.player('seller').usdc - START_USDC_ATOMS
  }

  const alone = run(false)
  const together = run(true)
  assert.ok(together > alone)
  assert.ok(alone > 90_000_000n)
})

test('a sell pushes the clearing price down for another seller', () => {
  const time = clock()
  const book = openBook(time)
  book.hello('a', 'Ann', time.now())
  book.hello('b', 'Bo', time.now())
  book.place('a', { preset: 'sell-10-300' }, time.now())
  const quote = book.snapshot('b', time.now())
  const sell = quote.presets.find((item) => item.id === 'sell-1-60')
  assert.match(sell.impact, /^-/)
  assert.ok(Number(sell.px) < 100)
})

test('cancel stops the rest of the stream and frees the balance', () => {
  const time = clock()
  const book = openBook(time)
  book.hello('a', 'Ann', time.now())
  const placed = book.place('a', { preset: 'buy-1000-300' }, time.now())
  time.advance(2_000)
  book.setMarket(
    { baseFlow: BASE, fetchedAt: time.now(), quoteFlow: QUOTE, slot: 13 },
    time.now(),
  )
  const mid = book.player('a').usdc
  assert.ok(mid < START_USDC_ATOMS)
  const canceled = book.cancel('a', placed.orderId, time.now())
  assert.equal(canceled.ok, true)
  const usdc = book.player('a').usdc
  time.advance(60_000)
  book.setMarket(
    { baseFlow: BASE, fetchedAt: time.now(), quoteFlow: QUOTE, slot: 14 },
    time.now(),
  )
  assert.equal(book.player('a').usdc, usdc)
})

test('rejects an order the wallet cannot cover', () => {
  const time = clock()
  const book = openBook(time)
  book.hello('a', 'Ann', time.now())
  assert.equal(
    book.place('a', { amount: '10001', seconds: 30, side: 'buy' }, time.now())
      .error,
    'Not enough USDC',
  )
  assert.equal(
    book.place('a', { amount: '0.0001', seconds: 30, side: 'sell' }, time.now())
      .error,
    'Amount too small',
  )
  assert.equal(
    book.place('a', { preset: 'nope' }, time.now()).error,
    'Unknown stream',
  )
})

test('a stale market pauses fills instead of trading at an old price', () => {
  const time = clock()
  const book = openBook(time)
  book.hello('a', 'Ann', time.now())
  book.place('a', { amount: '100', seconds: 30, side: 'buy' }, time.now())
  time.advance(20_000)
  book.settle(time.now())
  const player = book.player('a')
  assert.equal(player.usdc, START_USDC_ATOMS)
  assert.equal(player.sol, START_SOL_ATOMS)
  assert.equal(book.snapshot('a', time.now()).stale, true)
})

test('state reloads with the same balances and join price', () => {
  const time = clock()
  const book = openBook(time)
  book.hello('a', 'Ann', time.now())
  book.place('a', { amount: '100', seconds: 10, side: 'buy' }, time.now())
  time.advance(10_000)
  book.setMarket(
    { baseFlow: BASE, fetchedAt: time.now(), quoteFlow: QUOTE, slot: 15 },
    time.now(),
  )
  const saved = book.serialize()
  const restored = createBook({
    now: time.now,
    state: JSON.parse(JSON.stringify(saved)),
  })
  restored.setMarket(
    { baseFlow: BASE, fetchedAt: time.now(), quoteFlow: QUOTE, slot: 16 },
    time.now(),
  )
  assert.equal(restored.player('a').usdc, book.player('a').usdc)
  assert.equal(restored.player('a').sol, book.player('a').sol)
  assert.equal(
    restored.snapshot('a', time.now()).me.pnl,
    book.snapshot('a', time.now()).me.pnl,
  )
})

test('a badge snapshot stays inside the proxy body limit', () => {
  const time = clock()
  const book = openBook(time)
  for (let index = 0; index < 8; index += 1) {
    book.hello(`badge${index}`, `p${index}`, time.now())
  }
  book.place('badge0', { preset: 'buy-100-60' }, time.now())
  book.place('badge0', { preset: 'sell-1-60' }, time.now())
  const bytes = Buffer.byteLength(
    JSON.stringify(book.snapshot('badge0', time.now())),
  )
  assert.ok(bytes < 3000, `snapshot is ${bytes} bytes`)
})

test('a ticket quote and stream chart stay inside one badge response', () => {
  const time = clock()
  const book = openBook(time)
  book.hello('a', 'Ann', time.now())
  const view = {
    amount: '1000',
    seconds: 600,
    side: 'buy',
    ticket: true,
  }
  const placed = book.place(
    'a',
    { amount: '1000', seconds: 60, side: 'buy' },
    time.now(),
    view,
  )
  assert.equal(placed.snapshot.presets, undefined)
  assert.equal(typeof placed.snapshot.quote.impact, 'string')
  assert.ok(
    Number(placed.snapshot.me.freeUsdc) < Number(placed.snapshot.me.usdc),
  )
  for (let step = 0; step < 6; step += 1) {
    time.advance(6_000)
    book.setMarket(
      {
        baseFlow: BASE,
        fetchedAt: time.now(),
        quoteFlow: QUOTE,
        slot: 40 + step,
      },
      time.now(),
    )
  }
  const shot = book.snapshot('a', time.now(), view)
  assert.ok(shot.orders[0].px.length >= 2)
  assert.ok(shot.orders[0].px.length <= 12)
  assert.notEqual(shot.orders[0].avg, '--')
  const bytes = Buffer.byteLength(JSON.stringify(shot))
  assert.ok(bytes < 3500, `ticket snapshot is ${bytes} bytes`)
})

const HIGHER_QUOTE = 1_100_000_000_000_000_000n

test('each player opens at zero against the price when they join', () => {
  const time = clock()
  const book = openBook(time)
  book.hello('early', 'Ann', time.now())
  assert.equal(book.snapshot('early', time.now()).me.pnl, '+0.00')

  time.advance(1_000)
  book.setMarket(
    {
      baseFlow: BASE,
      fetchedAt: time.now(),
      quoteFlow: HIGHER_QUOTE,
      slot: 20,
    },
    time.now(),
  )
  assert.equal(book.snapshot('early', time.now()).me.pnl, '+1000.00')

  book.hello('late', 'Bea', time.now())
  assert.equal(book.snapshot('late', time.now()).me.pnl, '+0.00')
  assert.equal(book.snapshot('early', time.now()).me.pnl, '+1000.00')

  const saved = book.serialize()
  assert.equal(saved.mark0, undefined)
  assert.equal(
    saved.players.find((player) => player.id === 'late').startQuoteFlow,
    HIGHER_QUOTE.toString(),
  )
})

test('a player who joins before a price is flat once the market arrives', () => {
  const time = clock()
  const book = createBook({ now: time.now })
  const waiting = book.hello('a', 'Ann', time.now())
  assert.equal(waiting.snapshot.me.pnl, '--')
  book.setMarket(
    { baseFlow: BASE, fetchedAt: time.now(), quoteFlow: QUOTE, slot: 21 },
    time.now(),
  )
  assert.equal(book.snapshot('a', time.now()).me.pnl, '+0.00')
})

test('an old shared mark is kept as each existing player baseline', () => {
  const time = clock()
  const book = createBook({
    now: time.now,
    state: {
      feeBps: 2,
      mark0: { baseFlow: BASE.toString(), quoteFlow: QUOTE.toString() },
      nextOrder: 1,
      orders: [],
      players: [
        {
          createdAt: time.now(),
          id: 'old',
          name: 'Old',
          sol: '100000000000',
          usdc: '10000000000',
        },
      ],
      settledAtMs: time.now(),
      version: 1,
    },
  })
  book.setMarket(
    {
      baseFlow: BASE,
      fetchedAt: time.now(),
      quoteFlow: HIGHER_QUOTE,
      slot: 22,
    },
    time.now(),
  )
  assert.equal(book.snapshot('old', time.now()).me.pnl, '+1000.00')
  book.hello('new', 'New', time.now())
  assert.equal(book.snapshot('new', time.now()).me.pnl, '+0.00')
  const saved = book.serialize()
  assert.equal(saved.version, 2)
  assert.equal(saved.mark0, undefined)
  assert.equal(
    saved.players.find((player) => player.id === 'old').startBaseFlow,
    BASE.toString(),
  )
})
