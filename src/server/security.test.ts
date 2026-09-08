import { afterEach, expect, it, vi } from 'vitest'
import { secureResponse } from './security'
afterEach(() => vi.unstubAllEnvs())
it('restricts scripts to the request nonce and limits outbound connections to configured origins', async () => {
  vi.stubEnv('PROD', true)
  vi.stubEnv('VITE_SOLANA_RPC_URL', 'https://rpc.example.com/?token=not-in-csp')
  vi.stubEnv('VITE_SOLANA_WS_URL', 'wss://rpc.example.com/?token=not-in-csp')
  vi.stubEnv('VITE_READ_API_URL', 'https://read.example.com')
  const response = secureResponse(
    new Response('streamed body', { status: 201 }),
    'testnonce',
  )
  const csp = response.headers.get('Content-Security-Policy')!
  expect(csp).toContain("script-src 'nonce-testnonce' 'strict-dynamic'")
  expect(csp).toContain('https://rpc.example.com')
  expect(csp).not.toContain('not-in-csp')
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(response.headers.get('X-Frame-Options')).toBe('DENY')
  expect(response.status).toBe(201)
  expect(await response.text()).toBe('streamed body')
})
it('prevents previews from being indexed', () => {
  vi.stubEnv('VITE_DEPLOYMENT_MODE', 'preview')
  expect(secureResponse(new Response()).headers.get('X-Robots-Tag')).toBe(
    'noindex, nofollow',
  )
})
