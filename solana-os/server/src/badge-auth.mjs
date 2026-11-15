import { createHash, createPublicKey, verify } from 'node:crypto'

const KEY_URL = 'https://badge-api.solana.com/api/http/key'
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

function header(req, name) {
  const value = req.headers[name]
  if (Array.isArray(value)) return value[0] ?? ''
  return typeof value === 'string' ? value : ''
}

export function importEd25519Raw(raw) {
  if (raw.length !== 32) throw new Error('Ed25519 public key must be 32 bytes')
  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
    format: 'der',
    type: 'spki',
  })
}

export function createBadgeAuth({
  appId,
  fetchImpl = fetch,
  now = Date.now,
  publicBaseUrl = '',
  keyUrl = KEY_URL,
} = {}) {
  const keys = new Map()
  const seen = new Map()
  let fetching = null
  let fetchedAt = 0

  async function loadKey(id) {
    if (keys.has(id)) return keys.get(id)
    if (!fetching && now() - fetchedAt > 60_000) {
      fetchedAt = now()
      fetching = (async () => {
        const response = await fetchImpl(keyUrl)
        if (!response.ok)
          throw new Error(`Key request failed (${response.status})`)
        const body = await response.json()
        const raw = Buffer.from(body.key, 'base64')
        keys.set(body.id, importEd25519Raw(raw))
      })().finally(() => {
        fetching = null
      })
    }
    if (!keys.has(id) && fetching) {
      try {
        await fetching
      } catch {
        fetchedAt = 0
      }
    }
    return keys.get(id) ?? null
  }

  function remember(id, time) {
    for (const [key, seenAt] of seen) {
      if (now() - seenAt > 60_000) seen.delete(key)
    }
    if (seen.has(id)) return false
    seen.set(id, time)
    return true
  }

  function signedUrl(req) {
    if (publicBaseUrl) return new URL(req.url, publicBaseUrl).toString()
    const host = header(req, 'host') || 'localhost'
    return `https://${host}${req.url}`
  }

  async function verifyRequest(req, body) {
    const time = Number(header(req, 'x-badge-time'))
    const requestId = header(req, 'x-badge-request')
    const badgeApp = header(req, 'x-badge-app')
    const badgeId = header(req, 'x-badge-id')
    const user = header(req, 'x-badge-user')
    if (badgeApp !== appId) return null
    if (!/^[A-Za-z0-9]{4,24}$/.test(badgeId)) return null
    if (!(Math.abs(now() - time) < 60_000) || !requestId) return null
    const key = await loadKey(header(req, 'x-badge-key'))
    if (!key) return null
    const hash = createHash('sha256').update(body).digest('hex')
    const signed = [
      'badge-http-v1',
      req.method || 'GET',
      signedUrl(req),
      hash,
      appId,
      badgeId,
      user,
      header(req, 'x-badge-time'),
      requestId,
    ].join('\n')
    const signature = Buffer.from(header(req, 'x-badge-signature'), 'base64')
    const ok = verify(null, Buffer.from(signed), key, signature)
    if (!ok) return null
    if (!remember(requestId, time)) return null
    return { badge: badgeId, user }
  }

  return { verifyRequest, signedUrl }
}
