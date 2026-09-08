import handler from '@tanstack/react-start/server-entry'
import { secureResponse } from './server/security'
import { handleRpcProxy } from './server/rpc-proxy'

export default {
  async fetch(request: Request, env: Env) {
    const nonce = crypto.randomUUID().replaceAll('-', '')
    try {
      const path = new URL(request.url).pathname
      if (path === '/rpc' || path === '/rpc/ws') {
        const response = await handleRpcProxy(request, env)
        return response.status === 101 ? response : secureResponse(response)
      }
      if (new URL(request.url).pathname === '/healthz') {
        return secureResponse(
          Response.json({
            status: 'ok',
            tradingEnabled: import.meta.env.VITE_ENABLE_TRANSACTIONS === 'true',
          }),
        )
      }
      const response = await handler.fetch(request, { context: { nonce } })
      return secureResponse(response, nonce, request.url)
    } catch {
      // Do not log endpoint URLs, credentials, or wallet data in exception objects.
      console.error(JSON.stringify({ event: 'request_failed' }))
      return secureResponse(
        new Response('Service temporarily unavailable', { status: 503 }),
      )
    }
  },
}
