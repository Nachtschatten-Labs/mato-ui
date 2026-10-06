import { afterEach, expect, it, vi } from 'vitest'
import {
  SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
  isSolanaError,
} from '@solana/kit'
import type { Base64EncodedWireTransaction } from '@solana/kit'
import target from '../../deployment-target.json'
import { formatTransactionError } from '../features/trading/lib/transaction-errors'
import { createSolanaRpcWithRateLimitRetry } from '../integrations/solana/rpc'
import { handleRpcProxy } from './rpc-proxy'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it.each([
  {
    name: 'a program rejection',
    data: { err: { InstructionError: [0, { Custom: 6006 }] } },
    cause: { __code: 4_615_026, code: 6006, index: 0 },
    message:
      'Market timing changed while the transaction was awaiting wallet approval. Please try again.',
  },
  { name: 'missing error data', data: undefined },
  { name: 'null error data', data: null },
  { name: 'malformed error data', data: { err: { InstructionError: null } } },
])(
  'handles preflight failure with $name through the real RPC client',
  async ({ data, cause, message }) => {
    vi.stubEnv('VITE_ENABLE_TRANSACTIONS', 'true')
    vi.stubEnv('VITE_VERIFIED_PROGRAM_ID', target.programId)
    const endpoint = 'https://mato.markets/rpc'
    const upstream = 'https://rpc.example.com/private-provider-token'
    const env: Env = {
      SOLANA_RPC_URL: upstream,
      SOLANA_WS_URL: upstream.replace('https:', 'wss:'),
      RPC_RATE_LIMITER: { limit: async () => ({ success: true }) },
      RPC_WS_LIMITER: { limit: async () => ({ success: true }) },
    }
    const upstreamRequest = vi.fn(async (request: Request) => {
      expect(request.url).toBe(upstream)
      const payload = (await request.json()) as { id: string; method: string }
      expect(payload.method).toBe('sendTransaction')
      return Response.json({
        jsonrpc: '2.0',
        id: payload.id,
        error: {
          code: -32002,
          message: `Provider failure: ${upstream}`,
          data,
        },
      })
    })
    // Every request stays in this test. No transaction reaches a network.
    vi.stubGlobal(
      'fetch',
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init)
        return request.url === endpoint
          ? handleRpcProxy(request, env)
          : upstreamRequest(request)
      },
    )

    const rpc = createSolanaRpcWithRateLimitRetry(endpoint)
    const error = await rpc
      .sendTransaction('AQ==' as Base64EncodedWireTransaction, {
        encoding: 'base64',
      })
      .send()
      .catch((error: unknown) => error)

    expect(
      isSolanaError(
        error,
        SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
      ),
    ).toBe(true)
    if (cause) expect(error).toMatchObject({ cause: { context: cause } })
    if (message)
      expect(formatTransactionError(error, 'Failed to submit order.')).toBe(
        message,
      )
    expect(JSON.stringify(error)).not.toContain('private-provider-token')
    expect(upstreamRequest).toHaveBeenCalledTimes(1)
  },
)
