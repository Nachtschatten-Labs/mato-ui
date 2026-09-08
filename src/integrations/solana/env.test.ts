import { afterEach, expect, it, vi } from 'vitest'
import {
  getBrowserSolanaRpcEndpoint,
  getBrowserSolanaWebsocketEndpoint,
} from './env'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
it('uses the current browser origin, including previews, without provider secrets', () => {
  vi.stubGlobal('window', {
    location: { origin: 'https://preview.example.com' },
  })
  vi.stubEnv(
    'VITE_SOLANA_RPC_URL',
    'https://provider.example.com/private-token',
  )
  expect(getBrowserSolanaRpcEndpoint()).toBe('https://preview.example.com/rpc')
  expect(getBrowserSolanaWebsocketEndpoint()).toBe(
    'wss://preview.example.com/rpc/ws',
  )
})
it('uses the canonical site for server rendering', () => {
  vi.stubEnv('VITE_SITE_URL', 'https://site.example.com')
  expect(getBrowserSolanaRpcEndpoint()).toBe('https://site.example.com/rpc')
})
it('uses insecure WebSockets only for the local HTTP runtime', () => {
  expect(getBrowserSolanaWebsocketEndpoint('http://127.0.0.1:3017/rpc')).toBe(
    'ws://127.0.0.1:3017/rpc/ws',
  )
})
