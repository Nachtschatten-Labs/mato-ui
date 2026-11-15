import { createServer } from 'node:http'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createBadgeAuth } from './badge-auth.mjs'
import { createBook } from './book.mjs'
import { APP_ID, DEFAULT_READ_API_URL } from './constants.mjs'
import { fetchMarket } from './market.mjs'

const pagePath = fileURLToPath(new URL('../public/index.html', import.meta.url))
const pageHtml = readFileSync(pagePath, 'utf8')

function readState(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    if (error && error.code === 'ENOENT') return null
    throw error
  }
}

function writeState(path, book) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(book.serialize()))
  renameSync(tmp, path)
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  const payload = typeof body === 'string' ? body : JSON.stringify(body)
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
    'content-type': type,
  })
  res.end(payload)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 2048) {
        reject(Object.assign(new Error('Request too big'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function devId(req, allowDev) {
  if (!allowDev) return null
  const raw = req.headers['x-dev-badge']
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string') return null
  if (!/^[a-z0-9][a-z0-9-]{0,15}$/.test(value)) return null
  return `dev:${value}`
}

export function createApp({
  allowDev = false,
  appId = APP_ID,
  auth = null,
  book,
  fetchImpl = fetch,
  keyUrl,
  now = Date.now,
  publicBaseUrl = '',
  readApiUrl = DEFAULT_READ_API_URL,
  statePath = '',
} = {}) {
  if (!book) throw new Error('createApp requires a book')
  const badgeAuth =
    auth ??
    createBadgeAuth({
      appId,
      fetchImpl,
      keyUrl,
      now,
      publicBaseUrl,
    })

  const devScript = allowDev ? '<script>window.PAPER_DEV = true</script>' : ''
  const html = pageHtml.replace('</head>', `${devScript}</head>`)

  async function identify(req, body) {
    if (req.headers['x-badge-signature']) {
      const who = await badgeAuth.verifyRequest(req, body)
      if (!who) return { error: 'Bad badge signature', status: 401 }
      return { id: who.badge }
    }
    const dev = devId(req, allowDev)
    if (dev) return { id: dev }
    return { error: 'Badge auth required', status: 401 }
  }

  async function pollMarket() {
    const next = await fetchMarket(readApiUrl, fetchImpl, now())
    book.setMarket(next, now())
    if (statePath) writeState(statePath, book)
    return next
  }

  async function handle(req, res) {
    const url = new URL(req.url || '/', 'http://badge.local')
    try {
      if (
        req.method === 'GET' &&
        (url.pathname === '/' || url.pathname === '/index.html')
      ) {
        send(res, 200, html, 'text/html; charset=utf-8')
        return
      }
      if (req.method === 'GET' && url.pathname === '/health') {
        const view = book.board(now())
        send(res, 200, {
          ok: true,
          players: view.players,
          price: view.price,
          stale: view.stale,
        })
        return
      }
      if (req.method === 'GET' && url.pathname === '/v1/board') {
        send(res, 200, book.board(now()))
        return
      }

      const bodyText = req.method === 'GET' ? '' : await readBody(req)
      const who = await identify(req, bodyText)
      if (who.error) {
        send(res, who.status, { error: who.error })
        return
      }
      const payload = bodyText ? JSON.parse(bodyText) : {}
      const name = payload.name ?? url.searchParams.get('name') ?? ''
      const view = {
        amount: url.searchParams.get('amount') || payload.amount,
        seconds: Number(url.searchParams.get('seconds') || payload.seconds),
        side: url.searchParams.get('side') || payload.side,
        ticket:
          url.searchParams.get('ticket') === '1' ||
          payload.ticket === 1 ||
          payload.ticket === '1' ||
          payload.ticket === true,
      }

      if (req.method === 'GET' && url.pathname === '/v1/badge') {
        const joined = book.hello(who.id, name, now(), view)
        if (!joined.ok) {
          send(res, 400, { error: joined.error })
          return
        }
        if (statePath) writeState(statePath, book)
        send(res, 200, joined.snapshot)
        return
      }
      if (req.method === 'POST' && url.pathname === '/v1/badge/hello') {
        const joined = book.hello(who.id, name, now(), view)
        if (!joined.ok) {
          send(res, 400, { error: joined.error })
          return
        }
        if (statePath) writeState(statePath, book)
        send(res, 200, joined.snapshot)
        return
      }
      if (req.method === 'POST' && url.pathname === '/v1/badge/orders') {
        book.hello(who.id, name, now())
        const placed = book.place(who.id, payload, now(), view)
        if (!placed.ok) {
          send(res, 400, { error: placed.error })
          return
        }
        if (statePath) writeState(statePath, book)
        send(res, 200, placed.snapshot)
        return
      }
      if (req.method === 'POST' && url.pathname === '/v1/badge/orders/cancel') {
        const canceled = book.cancel(who.id, payload.id, now(), view)
        if (!canceled.ok) {
          send(res, 400, { error: canceled.error })
          return
        }
        if (statePath) writeState(statePath, book)
        send(res, 200, canceled.snapshot)
        return
      }
      send(res, 404, { error: 'Not found' })
    } catch (error) {
      const status = error && error.status ? error.status : 400
      send(res, status, {
        error:
          error instanceof SyntaxError
            ? 'Bad JSON'
            : error.message || 'Bad request',
      })
    }
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((error) => {
      if (!res.headersSent) send(res, 500, { error: 'Server error' })
      console.error(error)
    })
  })

  return { handle, html, pollMarket, server }
}

export function start(options = {}) {
  const port = Number(options.port ?? process.env.PORT ?? 8080)
  const host = options.host ?? '0.0.0.0'
  const statePath = options.statePath ?? process.env.PAPER_STATE_PATH ?? ''
  const allowDev =
    options.allowDev ??
    (process.env.MATO_PAPER_ALLOW_DEV === '1' ||
      (process.env.MATO_PAPER_ALLOW_DEV !== '0' &&
        process.env.NODE_ENV !== 'production'))
  const book =
    options.book ??
    createBook({
      feeBps: Number(process.env.PAPER_FEE_BPS ?? 2),
      state: statePath ? readState(statePath) : null,
    })
  const app = createApp({
    ...options,
    allowDev,
    appId: options.appId ?? process.env.PAPER_APP_ID ?? APP_ID,
    book,
    statePath,
  })
  let timer = null
  if (options.poll !== false) {
    const tick = () => {
      app.pollMarket().catch((error) => {
        console.error(`Market poll failed: ${error.message}`)
      })
    }
    tick()
    timer = setInterval(tick, Number(process.env.PAPER_POLL_MS ?? 2000))
    timer.unref?.()
  }
  const listening = new Promise((resolve) => {
    app.server.listen(port, host, () => resolve(app.server.address()))
  })
  return {
    ...app,
    book,
    listening,
    async close() {
      if (timer) clearInterval(timer)
      await new Promise((resolve, reject) => {
        app.server.close((error) => (error ? reject(error) : resolve()))
      })
    },
  }
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : ''
if (entry === import.meta.url) {
  const running = start()
  running.listening.then((address) => {
    const shown =
      address && typeof address === 'object'
        ? `${address.address}:${address.port}`
        : String(address)
    console.log(`Mato listening on ${shown}`)
  })
}
