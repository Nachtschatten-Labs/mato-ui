import handler from '@tanstack/react-start/server-entry'
import { secureResponse } from './server/security'

export default {
  async fetch(request: Request) {
    const nonce = crypto.randomUUID().replaceAll('-', '')
    try {
      if (new URL(request.url).pathname === '/healthz') {
        return secureResponse(
          Response.json({
            status: 'ok',
            tradingEnabled: import.meta.env.VITE_ENABLE_TRANSACTIONS === 'true',
          }),
        )
      }
      const response = await handler.fetch(request, { context: { nonce } })
      return secureResponse(response, nonce)
    } catch {
      // Do not log endpoint URLs, credentials, or wallet data in exception objects.
      console.error(JSON.stringify({ event: 'request_failed' }))
      return secureResponse(
        new Response('Service temporarily unavailable', { status: 503 }),
      )
    }
  },
}
