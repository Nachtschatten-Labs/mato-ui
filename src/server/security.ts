export function secureResponse(
  response: Response,
  nonce?: string,
  requestUrl?: string,
) {
  const headers = new Headers(response.headers)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('Referrer-Policy', 'no-referrer')
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  headers.set('Strict-Transport-Security', 'max-age=31536000')
  headers.set('Cache-Control', 'no-store')
  if (
    import.meta.env.VITE_DEPLOYMENT_MODE !== 'production' ||
    import.meta.env.VITE_SITE_URL !== 'https://mato.markets'
  ) {
    headers.set('X-Robots-Tag', 'noindex, nofollow')
  }
  if (nonce && import.meta.env.PROD) {
    const websocketOrigin = requestUrl ? new URL(requestUrl) : undefined
    if (websocketOrigin)
      websocketOrigin.protocol =
        websocketOrigin.protocol === 'http:' ? 'ws:' : 'wss:'
    const connections = [
      websocketOrigin?.origin,
      import.meta.env.VITE_READ_API_URL,
      import.meta.env.VITE_SOLANA_RPC_URL,
      import.meta.env.VITE_SOLANA_WS_URL,
    ]
      .filter(Boolean)
      .map((value) => new URL(value).origin)
    headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        `script-src 'nonce-${nonce}' 'strict-dynamic'`,
        "script-src-attr 'none'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        `connect-src 'self' ${[...new Set(connections)].join(' ')}`,
        "object-src 'none'",
        "base-uri 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
      ].join('; '),
    )
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
