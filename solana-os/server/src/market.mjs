import { DEFAULT_READ_API_URL, MARKET_ADDRESS } from './constants.mjs'

// Same read API the trading UI uses. Price is GET .../price. Depth is the
// latest market update (base_flow, quote_flow), not a websocket: the badge
// proxy only has room for a few kilobytes, and the server is the one client.

export function marketUrls(readApiUrl = DEFAULT_READ_API_URL) {
  const base = readApiUrl.replace(/\/$/, '').replace(/\/v1$/, '')
  const root = `${base}/v1/markets/${MARKET_ADDRESS}`
  return {
    price: `${root}/price`,
    updates: `${root}/updates?limit=1`,
  }
}

export function parseMarketPayload(priceJson, updatesJson, fetchedAt) {
  const item = updatesJson?.items?.[0]
  if (!item) throw new Error('Market update did not include a flow')
  if (
    priceJson?.market_address !== MARKET_ADDRESS ||
    item.market_address !== MARKET_ADDRESS
  ) {
    throw new Error('Market data returned a different market address')
  }
  const baseFlow = BigInt(item.base_flow)
  const quoteFlow = BigInt(item.quote_flow)
  if (baseFlow < 0n || quoteFlow < 0n) throw new Error('Negative market flow')
  const slot = Number(item.slot)
  return {
    baseFlow,
    quoteFlow,
    slot: Number.isFinite(slot) ? slot : null,
    eventTime: typeof item.created_at === 'string' ? item.created_at : null,
    reportedPrice:
      typeof priceJson.price === 'number' && Number.isFinite(priceJson.price)
        ? priceJson.price
        : null,
    fetchedAt,
  }
}

export async function fetchMarket(
  readApiUrl,
  fetchImpl = fetch,
  now = Date.now(),
) {
  const urls = marketUrls(readApiUrl)
  const init = {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(5_000),
  }
  const [priceRes, updatesRes] = await Promise.all([
    fetchImpl(urls.price, init),
    fetchImpl(urls.updates, init),
  ])
  if (!priceRes.ok) {
    throw new Error(`Price request failed (${priceRes.status})`)
  }
  if (!updatesRes.ok) {
    throw new Error(`Flow request failed (${updatesRes.status})`)
  }
  const priceJson = await priceRes.json()
  const updatesJson = await updatesRes.json()
  return parseMarketPayload(priceJson, updatesJson, now)
}
