function browserOrigin() {
  return typeof window === 'undefined'
    ? import.meta.env.VITE_SITE_URL || 'https://mato.markets'
    : window.location.origin
}

export function getBrowserSolanaRpcEndpoint() {
  return new URL('/rpc', browserOrigin()).toString()
}

export function getBrowserSolanaWebsocketEndpoint(
  endpoint = getBrowserSolanaRpcEndpoint(),
) {
  const url = new URL('/rpc/ws', endpoint)
  url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:'
  return url.toString()
}

export const getSolanaRpcEndpoint = getBrowserSolanaRpcEndpoint
export const getSolanaWebsocketEndpoint = getBrowserSolanaWebsocketEndpoint
