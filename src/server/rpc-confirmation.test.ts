import { afterEach, expect, it, vi } from 'vitest'
import { createClient } from '@solana/client'
import {
  address,
  assertIsFullySignedTransaction,
  assertIsTransactionWithinSizeLimit,
  blockhash,
  compileTransaction,
  createTransactionMessage,
  getBase58Decoder,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  signatureBytes,
} from '@solana/kit'
import target from '../../deployment-target.json'
import { handleRpcProxy } from './rpc-proxy'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('confirms a submitted transaction through the proxy using the real client confirmation flow', async () => {
  vi.stubEnv('VITE_ENABLE_TRANSACTIONS', 'true')
  vi.stubEnv('VITE_VERIFIED_PROGRAM_ID', target.programId)
  const endpoint = 'https://devnet.mato.markets/rpc'
  const upstream = 'https://rpc.example.com/test'
  const env: Env = {
    SOLANA_RPC_URL: upstream,
    SOLANA_WS_URL: 'wss://rpc.example.com/test',
    RPC_RATE_LIMITER: { limit: async () => ({ success: true }) },
    RPC_WS_LIMITER: { limit: async () => ({ success: true }) },
  }
  const payer = address('11111111111111111111111111111111')
  const signedBytes = signatureBytes(new Uint8Array(64).fill(1))
  const signature = getBase58Decoder().decode(signedBytes)
  const lifetime = {
    blockhash: blockhash('11111111111111111111111111111111'),
    lastValidBlockHeight: 100n,
  }
  const transaction = {
    ...compileTransaction(
      setTransactionMessageLifetimeUsingBlockhash(
        lifetime,
        setTransactionMessageFeePayer(
          payer,
          createTransactionMessage({ version: 0 }),
        ),
      ),
    ),
    signatures: { [payer]: signedBytes },
  }
  assertIsFullySignedTransaction(transaction)
  assertIsTransactionWithinSizeLimit(transaction)

  const upstreamMethods: string[] = []
  let resolveEpochRead!: () => void
  const epochRead = new Promise<void>((resolve) => {
    resolveEpochRead = resolve
  })
  // Every fetch stays in this test; no transaction or request reaches a network.
  vi.stubGlobal(
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init)
      if (request.url === endpoint) return handleRpcProxy(request, env)
      expect(request.url).toBe(upstream)
      const payload = (await request.json()) as { id: string; method: string }
      upstreamMethods.push(payload.method)
      let result: unknown
      switch (payload.method) {
        case 'getLatestBlockhash':
          result = {
            context: { slot: 1 },
            value: { ...lifetime, lastValidBlockHeight: 100 },
          }
          break
        case 'sendTransaction':
          result = signature
          break
        case 'getEpochInfo':
          result = {
            absoluteSlot: 50,
            blockHeight: 40,
            epoch: 1,
            slotIndex: 10,
            slotsInEpoch: 100,
          }
          resolveEpochRead()
          break
        case 'getSignatureStatuses':
          // Make the expiry check run before confirmation can complete.
          await epochRead
          result = {
            context: { slot: 50 },
            value: [
              {
                slot: 50,
                confirmations: 1,
                err: null,
                confirmationStatus: 'confirmed',
              },
            ],
          }
          break
        default:
          throw new Error(`Unexpected RPC method: ${payload.method}`)
      }
      return Response.json({ jsonrpc: '2.0', id: payload.id, result })
    },
  )

  // Confirmation can also arrive through HTTP; keep subscriptions open until it does.
  const subscribe = async ({ abortSignal }: { abortSignal: AbortSignal }) => ({
    async *[Symbol.asyncIterator]() {
      if (!abortSignal.aborted) {
        await new Promise<void>((resolve) =>
          abortSignal.addEventListener('abort', () => resolve(), {
            once: true,
          }),
        )
      }
    },
  })
  const client = createClient({
    endpoint,
    websocketEndpoint: 'wss://devnet.mato.markets/rpc/ws',
  })
  Object.assign(client.runtime, {
    rpcSubscriptions: {
      slotNotifications: () => ({ subscribe }),
      signatureNotifications: () => ({ subscribe }),
    },
  })
  try {
    await expect(
      client.actions.sendTransaction(transaction, 'confirmed'),
    ).resolves.toBe(signature)
    expect(upstreamMethods).toContain('getEpochInfo')
    expect(
      upstreamMethods.filter((method) => method === 'sendTransaction'),
    ).toHaveLength(1)
    expect(client.store.getState().transactions[signature]?.status).toBe(
      'confirmed',
    )
  } finally {
    client.destroy()
  }
})
