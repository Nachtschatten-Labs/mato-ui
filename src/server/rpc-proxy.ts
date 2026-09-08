import target from '../../deployment-target.json'
import { validateRpcPayload, sanitizeRpcResponse } from './rpc-policy'

const MAX_REQUEST_BYTES = 64 * 1024
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024
const encoder = new TextEncoder()

async function readLimitedBody(
  body: ReadableStream<Uint8Array> | null,
  limit: number,
) {
  if (!body) throw new Error('Empty body')
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) {
        await reader.cancel()
        throw new Error('Body too large')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

function failure(status: number, message: string) {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...(status === 429 ? { 'Retry-After': '60' } : {}),
      },
    },
  )
}

function upstreamUrl(value: string | undefined, websocket: boolean) {
  const fallback = websocket
    ? target.defaultRpcUrl.replace('https:', 'wss:')
    : target.defaultRpcUrl
  if (!value && import.meta.env.VITE_DEPLOYMENT_MODE === 'production')
    throw new Error('Missing RPC secret')
  const url = new URL(value || fallback)
  if (
    url.protocol !== (websocket ? 'wss:' : 'https:') ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error('Invalid RPC secret')
  if (websocket) url.protocol = 'https:'
  return url.toString()
}

export async function handleRpcProxy(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url)
  const origin = request.headers.get('Origin')
  const websocket = url.pathname === '/rpc/ws'
  // This is a public RPC facade, not authentication. Limits also apply to non-browser clients.
  if (origin && origin !== url.origin)
    return failure(403, 'Cross-origin RPC requests are not allowed')
  if (url.search) return failure(400, 'RPC query parameters are not allowed')
  if (
    websocket
      ? request.method !== 'GET' ||
        request.headers.get('Upgrade')?.toLowerCase() !== 'websocket'
      : request.method !== 'POST'
  )
    return failure(405, 'Unsupported RPC request')
  if (
    !websocket &&
    request.headers.get('Content-Type')?.split(';')[0].trim() !==
      'application/json'
  )
    return failure(415, 'Use application/json')
  const ip = request.headers.get('CF-Connecting-IP') || 'local'
  const limiter = websocket ? env.RPC_WS_LIMITER : env.RPC_RATE_LIMITER
  if (!limiter || !(await limiter.limit({ key: ip })).success)
    return failure(429, 'RPC request limit reached')
  const tradingEnabled =
    import.meta.env.VITE_ENABLE_TRANSACTIONS === 'true' &&
    import.meta.env.VITE_VERIFIED_PROGRAM_ID === target.programId
  try {
    if (websocket) return await proxyWebSocket(env, ip, tradingEnabled)
    let payload: unknown
    try {
      payload = JSON.parse(
        await readLimitedBody(request.body, MAX_REQUEST_BYTES),
      )
    } catch {
      return failure(400, 'Invalid or oversized RPC request')
    }
    if (!validateRpcPayload(payload, 'http', target.programId, tradingEnabled))
      return failure(403, 'RPC method or parameters are not allowed')
    const response = await fetch(upstreamUrl(env.SOLANA_RPC_URL, false), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'manual',
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) {
      await response.body?.cancel()
      return failure(
        response.status === 429 ? 429 : 502,
        'Solana RPC is temporarily unavailable',
      )
    }
    const result = sanitizeRpcResponse(
      JSON.parse(await readLimitedBody(response.body, MAX_RESPONSE_BYTES)),
    )
    return Response.json(result, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return failure(502, 'Solana RPC is temporarily unavailable')
  }
}

async function proxyWebSocket(env: Env, ip: string, tradingEnabled: boolean) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  let response: Response
  try {
    response = await fetch(upstreamUrl(env.SOLANA_WS_URL, true), {
      headers: { Upgrade: 'websocket' },
      redirect: 'manual',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
  const upstream = response.webSocket
  if (response.status !== 101 || !upstream) {
    await response.body?.cancel()
    return failure(502, 'Solana subscriptions are temporarily unavailable')
  }
  const pair = new WebSocketPair()
  const client = pair[0]
  const server = pair[1]
  upstream.accept()
  server.accept()
  let closed = false
  const close = (code = 1000) => {
    if (closed) return
    closed = true
    try {
      server.close(code, 'RPC connection closed')
    } catch {
      /* Already closed. */
    }
    try {
      upstream.close(code, 'RPC connection closed')
    } catch {
      /* Already closed. */
    }
  }
  let pending = 0
  let queue = Promise.resolve()
  server.addEventListener('message', (event) => {
    if (closed) return
    if (
      typeof event.data !== 'string' ||
      encoder.encode(event.data).byteLength > MAX_REQUEST_BYTES ||
      pending >= 10
    ) {
      close(1009)
      return
    }
    const data = event.data
    pending++
    queue = queue
      .then(async () => {
        if (closed) return
        const payload: unknown = JSON.parse(data)
        if (
          !validateRpcPayload(
            payload,
            'websocket',
            target.programId,
            tradingEnabled,
          )
        ) {
          close(1008)
          return
        }
        if (!(await env.RPC_RATE_LIMITER.limit({ key: 'ws:' + ip })).success) {
          close(1008)
          return
        }
        upstream.send(JSON.stringify(payload))
      })
      .catch(() => close(1011))
      .finally(() => {
        pending--
      })
  })
  upstream.addEventListener('message', (event) => {
    if (closed) return
    try {
      if (
        typeof event.data !== 'string' ||
        encoder.encode(event.data).byteLength > MAX_RESPONSE_BYTES
      ) {
        close(1009)
        return
      }
      server.send(JSON.stringify(sanitizeRpcResponse(JSON.parse(event.data))))
    } catch {
      close(1011)
    }
  })
  server.addEventListener('close', () => close())
  upstream.addEventListener('close', () => close())
  server.addEventListener('error', () => close(1011))
  upstream.addEventListener('error', () => close(1011))
  return new Response(null, { status: 101, webSocket: client })
}
