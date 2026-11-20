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
  assert.match(placed.snapshot.quote.impact, /^[+-]\d+\.\d{4}%$/)
  assert.match(placed.snapshot.quote.px, /^\d+\.\d{4}$/)
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
  const shot = book.snapshot('a', time.now(), {
    ...view,
    ord: placed.orderId,
  })
  assert.ok(shot.orders[0].px.length >= 2)
  assert.ok(shot.orders[0].px.length <= 25)
  assert.equal(shot.orders[0].px[0][0], 0)
  assert.ok(shot.orders[0].px.at(-1)[0] > 0)
  assert.ok(shot.orders[0].px.at(-1)[0] < 1000)
  assert.match(shot.orders[0].pct, /^\d+\.\d{2}$/)
  assert.match(shot.orders[0].flow, /^spent .+ -> got /)
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

test('ten open streams and one chart fit in a badge response', () => {
  const time = clock()
  const book = openBook(time)
  book.hello('a', 'Ann', time.now())
  let last
  for (let index = 0; index < 10; index += 1) {
    last = book.place(
      'a',
      { amount: '100', seconds: 600, side: 'buy' },
      time.now(),
    )
    assert.equal(last.ok, true)
  }
  assert.equal(
    book.place('a', { amount: '100', seconds: 600, side: 'buy' }, time.now())
      .error,
    'Too many streams',
  )
  time.advance(6_000)
  book.setMarket(
    { baseFlow: BASE, fetchedAt: time.now(), quoteFlow: QUOTE, slot: 90 },
    time.now(),
  )
  const shot = book.snapshot('a', time.now(), {
    amount: '100',
    ord: last.orderId,
    seconds: 600,
    side: 'buy',
    ticket: true,
  })
  const open = shot.orders.filter((order) => order.status === 'open')
  assert.equal(open.length, 10)
  assert.equal(open.filter((order) => order.px).length, 1)
  assert.ok(open.every((order) => typeof order.inR === 'number'))
  const bytes = Buffer.byteLength(JSON.stringify(shot))
  assert.ok(bytes < 3500, `ten-stream snapshot is ${bytes} bytes`)
})

function bucketStartsBefore(permille) {
  const starts = []
  for (let index = 0; index < 24; index += 1) {
    const start = Math.floor((index * 1000) / 24)
    const end = Math.floor(((index + 1) * 1000) / 24)
    if (end <= permille) starts.push(start)
  }
  return starts
}

test('chart history stays fixed when the price changes and after a restart', () => {
  const time = clock()
  const book = openBook(time)
  book.hello('a', 'Ann', time.now())
  const placed = book.place(
    'a',
    { amount: '1000', seconds: 3600, side: 'buy' },
    time.now(),
  )
  const view = {
    amount: '1000',
    ord: placed.orderId,
    seconds: 3600,
    side: 'buy',
    ticket: true,
  }
  time.advance(720_000)
  book.setMarket(
    { baseFlow: BASE, fetchedAt: time.now(), quoteFlow: QUOTE, slot: 30 },
    time.now(),
  )
  const early = book.snapshot('a', time.now(), view).orders[0]
  assert.equal(early.px.at(-1)[0], 200)
  const earlyHistory = early.px.filter((point) => point[0] < 200)
  assert.deepEqual(
    earlyHistory.map((point) => point[0]),
    bucketStartsBefore(200),
  )
  const plotted = earlyHistory.map((point) => point[1])
  assert.ok(Math.max(...plotted) - Math.min(...plotted) <= 1)
  assert.ok(Math.abs(Number(early.avg) - plotted[0] / 100) <= 0.02)
  assert.ok(plotted[0] > 10_000)

  time.advance(720_000)
  book.setMarket(
    {
      baseFlow: BASE,
      fetchedAt: time.now(),
      quoteFlow: HIGHER_QUOTE,
      slot: 31,
    },
    time.now(),
  )
  const later = book.snapshot('a', time.now(), view).orders[0]
  assert.equal(later.px.at(-1)[0], 400)
  for (const point of earlyHistory) {
    assert.deepEqual(
      later.px.find((item) => item[0] === point[0]),
      point,
    )
  }
  assert.ok(
    later.px.some((point) => point[0] >= 200 && point[1] > plotted[0] + 50),
  )
  const prices = later.px.map((point) => point[1])
  const avgCents = Math.round(Number(later.avg) * 100)
  assert.ok(avgCents + 1 >= Math.min(...prices))
  assert.ok(avgCents - 1 <= Math.max(...prices))

  const saved = JSON.parse(JSON.stringify(book.serialize()))
  assert.ok(saved.orders[0].buckets.some((slot) => slot && slot.closed))
  const restored = createBook({ now: time.now, state: saved })
  restored.setMarket(
    {
      baseFlow: BASE,
      fetchedAt: time.now(),
      quoteFlow: HIGHER_QUOTE,
      slot: 32,
    },
    time.now(),
  )
  time.advance(30_000)
  restored.setMarket(
    {
      baseFlow: BASE,
      fetchedAt: time.now(),
      quoteFlow: HIGHER_QUOTE,
      slot: 33,
    },
    time.now(),
  )
  const again = restored.snapshot('a', time.now(), view).orders[0]
  for (const point of earlyHistory) {
    assert.deepEqual(
      again.px.find((item) => item[0] === point[0]),
      point,
    )
  }
  assert.ok(again.px.at(-1)[0] > 400)

  const legacy = JSON.parse(JSON.stringify(saved))
  legacy.orders[0].samples = [
    { c: 10_000, p: 0, t: 1 },
    { c: 13_000, p: 50, t: 2 },
  ]
  delete legacy.orders[0].buckets
  delete legacy.orders[0].chartFrom
  const migrated = createBook({ now: time.now, state: legacy })
  migrated.setMarket(
    {
      baseFlow: BASE,
      fetchedAt: time.now(),
      quoteFlow: HIGHER_QUOTE,
      slot: 34,
    },
    time.now(),
  )
  time.advance(60_000)
  migrated.setMarket(
    {
      baseFlow: BASE,
      fetchedAt: time.now(),
      quoteFlow: HIGHER_QUOTE,
      slot: 35,
    },
    time.now(),
  )
  const migratedPx = migrated.snapshot('a', time.now(), view).orders[0].px
  assert.deepEqual(
    migratedPx.find((point) => point[0] === 0),
    [0, 10_000],
  )
})

test('a leaderboard page stays under the proxy limit and marks the player', () => {
  const time = clock()
  const book = openBook(time)
  for (let index = 0; index < 25; index += 1) {
    book.hello(
      `badge${index}`,
      `player${String(index).padStart(2, '0')}`,
      time.now(),
    )
  }
  const whole = book.board(time.now())
  assert.equal(whole.total, 25)
  assert.equal(whole.offset, 0)
  assert.equal(whole.rows.length, 20)
  assert.equal(whole.rows[0].rank, 1)
  const tail = book.board(time.now(), { limit: 20, offset: 20 })
  assert.equal(tail.rows.length, 5)
  assert.equal(tail.rows[0].rank, 21)
  assert.equal(tail.offset, 20)
  const past = book.board(time.now(), { limit: 20, offset: 80 })
  assert.equal(past.rows.length, 0)
  assert.equal(past.offset, 25)
  assert.ok(Buffer.byteLength(JSON.stringify(whole)) < 3500)

  const mine = book.snapshot('badge12', time.now())
  const off = Math.max(0, mine.me.rank - 1)
  const shot = book.snapshot('badge12', time.now(), {
    board: true,
    lim: 12,
    off,
    ticket: true,
  })
  assert.equal(shot.top, undefined)
  assert.equal(shot.board.total, 25)
  assert.equal(shot.board.me, mine.me.rank)
  assert.equal(shot.board.rows[0].rank, off + 1)
  const self = shot.board.rows.find((row) => row.me === 1)
  assert.equal(self.rank, mine.me.rank)
  assert.equal(self.name, 'player12')
  assert.equal(shot.board.rows.filter((row) => row.me === 1).length, 1)
  const next = book.snapshot('badge12', time.now(), {
    board: true,
    lim: 12,
    off: off + 12,
    ticket: true,
  })
  assert.equal(next.board.rows[0].rank, off + 13)
  assert.equal(
    next.board.rows.some((row) => row.rank === self.rank),
    false,
  )
  for (let index = 0; index < 10; index += 1) {
    book.place(
      'badge12',
      { amount: '100', seconds: 600, side: 'buy' },
      time.now(),
    )
  }
  const busy = book.snapshot('badge12', time.now(), {
    board: true,
    lim: 12,
    off: 0,
    ticket: true,
  })
  assert.equal(busy.orders.length, 10)
  assert.equal(busy.board.rows.length, 12)
  const bytes = Buffer.byteLength(JSON.stringify(busy))
  assert.ok(bytes < 3500, `board snapshot is ${bytes} bytes`)
})

test('a sell chart matches the average execution price', () => {
  const time = clock()
  const book = openBook(time)
  book.hello('a', 'Ann', time.now())
  const placed = book.place(
    'a',
    { amount: '10', seconds: 600, side: 'sell' },
    time.now(),
  )
  time.advance(120_000)
  book.setMarket(
    { baseFlow: BASE, fetchedAt: time.now(), quoteFlow: QUOTE, slot: 40 },
    time.now(),
  )
  const order = book.snapshot('a', time.now(), {
    ord: placed.orderId,
    ticket: true,
  }).orders[0]
  assert.equal(order.px.at(-1)[0], 200)
  const prices = order.px.map((point) => point[1])
  assert.ok(Math.max(...prices) - Math.min(...prices) <= 1)
  assert.ok(prices[0] < 10_000)
  assert.ok(Math.abs(Number(order.avg) - prices[0] / 100) <= 0.02)
})
