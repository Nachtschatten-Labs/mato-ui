const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark">
    <title>Mato is temporarily offline</title>
    <style>
      * { box-sizing: border-box; }
      html { min-height: 100%; background: #101010; color: #faf8f5; }
      body { margin: 0; font-family: "Helvetica Neue", Arial, sans-serif; }
      main {
        min-height: 100vh;
        min-height: 100svh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 32px 24px;
        text-align: center;
      }
      .brand { margin: 0 0 28px; font-size: 24px; font-weight: 500; letter-spacing: -0.05em; }
      h1 { max-width: 680px; margin: 0; font-size: clamp(28px, 5vw, 48px); font-weight: 500; line-height: 1.2; letter-spacing: -0.035em; text-wrap: balance; }
    </style>
  </head>
  <body>
    <main>
      <p class="brand" aria-label="Mato">mato</p>
      <h1>Mato is temporarily offline</h1>
    </main>
  </body>
</html>`

export default {
  /** @param {Request} request */
  fetch(request) {
    const isHealth = new URL(request.url).pathname === '/healthz'
    const body = isHealth
      ? JSON.stringify({ status: 'offline', tradingEnabled: false })
      : page

    // Never forward a request to the app, RPC proxy, or another service.
    return new Response(request.method === 'HEAD' ? null : body, {
      status: 503,
      headers: {
        'Content-Type': isHealth
          ? 'application/json; charset=utf-8'
          : 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Retry-After': '3600',
        'Content-Security-Policy':
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'Strict-Transport-Security': 'max-age=31536000',
      },
    })
  },
}
