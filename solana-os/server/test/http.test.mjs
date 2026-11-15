import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'
import { createBook } from '../src/book.mjs'
import { createApp, start } from '../src/server.mjs'

const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const rawKey = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

test('dev badges can stream and show up on the public board', async () => {
  let now = 1_700_000_000_000
  const book = createBook({ now: () => now })
  book.setMarket(
    {
      baseFlow: 10_000_000_000_000_000_000n,
      fetchedAt: now,
      quoteFlow: 1_000_000_000_000_000_000n,
      slot: 1,
    },
    now,
  )
  const { server } = createApp({ allowDev: true, book, now: () => now })
  const port = await listen(server)
  try {
    const boardBefore = await fetch(`http://127.0.0.1:${port}/v1/board`)
    assert.equal(boardBefore.status, 200)
    const health = await fetch(`http://127.0.0.1:${port}/health`)
    assert.equal((await health.json()).ok, true)
    const page = await fetch(`http://127.0.0.1:${port}/`)
    const html = await page.text()
    assert.match(html, /Mato paper/)
    assert.match(html, /PAPER_DEV = true/)

    const denied = await fetch(`http://127.0.0.1:${port}/v1/badge`)
    assert.equal(denied.status, 401)

    const joined = await fetch(`http://127.0.0.1:${port}/v1/badge?name=ada`, {
      headers: { 'x-dev-badge': 'alice' },
    })
    assert.equal(joined.status, 200)
    const body = await joined.json()
    assert.equal(body.me.name, 'ada')
    assert.equal(body.me.pnl, '+0.00')
    assert.equal(body.feeBps, 2)

    const ordered = await fetch(`http://127.0.0.1:${port}/v1/badge/orders`, {
      body: JSON.stringify({ name: 'ada', preset: 'buy-100-60' }),
      headers: {
        'content-type': 'application/json',
        'x-dev-badge': 'alice',
      },
      method: 'POST',
    })
    assert.equal(ordered.status, 200)
    const orderBody = await ordered.json()
    assert.equal(orderBody.orders[0].status, 'open')

    now += 60_000
    book.setMarket(
      {
        baseFlow: 10_000_000_000_000_000_000n,
        fetchedAt: now,
        quoteFlow: 1_000_000_000_000_000_000n,
        slot: 2,
      },
      now,
    )
    const board = await fetch(`http://127.0.0.1:${port}/v1/board`)
    const listed = await board.json()
    assert.equal(listed.rows[0].name, 'ada')
    assert.match(listed.rows[0].pnl, /^-/)
  } finally {
    await close(server)
  }
})

test('signed badge requests are accepted once and rejected on replay', async () => {
  const now = 1_800_000_000_000
  const book = createBook({ now: () => now })
  book.setMarket(
    {
      baseFlow: 10_000_000_000_000_000_000n,
      fetchedAt: now,
      quoteFlow: 1_000_000_000_000_000_000n,
      slot: 3,
    },
    now,
  )
  const { server } = createApp({
    allowDev: false,
    book,
    fetchImpl: async () => ({
      json: async () => ({
        id: 'testkey',
        key: rawKey.toString('base64'),
      }),
      ok: true,
    }),
    now: () => now,
  })
  const port = await listen(server)
  try {
    const path = '/v1/badge?name=Ada'
    const headers = badgeHeaders({
      badge: '7K2Q9M',
      body: '',
      method: 'GET',
      requestId: 'abc123',
      time: now,
      url: `https://127.0.0.1:${port}${path}`,
    })
    const first = await fetch(`http://127.0.0.1:${port}${path}`, { headers })
    assert.equal(first.status, 200)
    assert.equal((await first.json()).me.name, 'Ada')
    const replay = await fetch(`http://127.0.0.1:${port}${path}`, { headers })
    assert.equal(replay.status, 401)
    const dev = await fetch(`http://127.0.0.1:${port}${path}`, {
      headers: { 'x-dev-badge': 'alice' },
    })
    assert.equal(dev.status, 401)
  } finally {
    await close(server)
  }
})

test('PAPER_FEE_BPS overrides the 2 bps default', async () => {
  const previous = process.env.PAPER_FEE_BPS
  process.env.PAPER_FEE_BPS = '7'
  const running = start({
    allowDev: true,
    host: '127.0.0.1',
    poll: false,
    port: 0,
  })
  try {
    const address = await running.listening
    const response = await fetch(
      `http://127.0.0.1:${address.port}/v1/badge?name=ada`,
      { headers: { 'x-dev-badge': 'fee' } },
    )
    assert.equal(response.status, 200)
    assert.equal((await response.json()).feeBps, 7)
  } finally {
    if (previous === undefined) delete process.env.PAPER_FEE_BPS
    else process.env.PAPER_FEE_BPS = previous
    await running.close()
  }
})

function badgeHeaders({ method, url, body, badge, time, requestId }) {
  const hash = createHash('sha256').update(body).digest('hex')
  const signed = [
    'badge-http-v1',
    method,
    url,
    hash,
    'mato-paper',
    badge,
    'user-1',
    String(time),
    requestId,
  ].join('\n')
  return {
    'x-badge-app': 'mato-paper',
    'x-badge-id': badge,
    'x-badge-key': 'testkey',
    'x-badge-request': requestId,
    'x-badge-signature': sign(null, Buffer.from(signed), privateKey).toString(
      'base64',
    ),
    'x-badge-time': String(time),
    'x-badge-user': 'user-1',
  }
}
