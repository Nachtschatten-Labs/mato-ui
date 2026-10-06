import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getSolanaErrorFromJsonRpcError,
  isSolanaError,
  SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
} from '@solana/kit'
import target from '../../deployment-target.json'
import { handleRpcProxy } from './rpc-proxy'
import { sanitizeRpcResponse, validateRpcPayload } from './rpc-policy'

const call = (method: string, params: unknown[] = []) => ({
  jsonrpc: '2.0',
  id: 1,
  method,
  params,
})
const request = (payload: unknown, headers: Record<string, string> = {}) =>
  new Request('https://mato.markets/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  })
const secret = 'https://rpc.example.com/private-provider-token'
const makeEnv = (): Env => ({
  SOLANA_RPC_URL: secret,
  SOLANA_WS_URL: secret.replace('https:', 'wss:'),
  RPC_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
  RPC_WS_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
})

describe('RPC proxy boundary', () => {
  it('allows read-only block timestamps for position charts', () => {
    expect(
      validateRpcPayload(
        call('getBlockTime', [123]),
        'http',
        target.programId,
        false,
      ),
    ).toBe(true)
  })
  beforeEach(() => {
    vi.stubEnv('VITE_DEPLOYMENT_MODE', 'production')
    vi.stubEnv('VITE_ENABLE_TRANSACTIONS', 'false')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })
  it('forwards only to the configured provider without visitor headers', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ jsonrpc: '2.0', id: 1, result: 'hash' }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const response = await handleRpcProxy(
      request(call('getGenesisHash'), {
        Authorization: 'visitor',
        Cookie: 'visitor',
      }),
      makeEnv(),
    )
    expect(await response.json()).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'hash',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      secret,
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
        redirect: 'manual',
      }),
    )
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
  it.each(['requestAirdrop', 'sendTransaction', 'getClusterNodes'])(
    'blocks %s in read-only mode',
    async (method) => {
      const upstream = vi.fn()
      vi.stubGlobal('fetch', upstream)
      expect(
        (await handleRpcProxy(request(call(method)), makeEnv())).status,
      ).toBe(403)
      expect(upstream).not.toHaveBeenCalled()
    },
  )
  it('allows submission only with enabled trading and the matching branch program', async () => {
    const upstream = vi
      .fn()
      .mockResolvedValue(
        Response.json({ jsonrpc: '2.0', id: 1, result: 'signature' }),
      )
    vi.stubGlobal('fetch', upstream)
    vi.stubEnv('VITE_ENABLE_TRANSACTIONS', 'true')
    vi.stubEnv('VITE_VERIFIED_PROGRAM_ID', 'wrong')
    expect(
      (await handleRpcProxy(request(call('sendTransaction')), makeEnv()))
        .status,
    ).toBe(403)
    vi.stubEnv('VITE_VERIFIED_PROGRAM_ID', target.programId)
    expect(
      (await handleRpcProxy(request(call('sendTransaction')), makeEnv()))
        .status,
    ).toBe(200)
  })
  it('blocks cross-origin calls and exhausted quotas before upstream access', async () => {
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)
    expect(
      (
        await handleRpcProxy(
          request(call('getSlot'), { Origin: 'https://other.example' }),
          makeEnv(),
        )
      ).status,
    ).toBe(403)
    const env = makeEnv()
    vi.mocked(env.RPC_RATE_LIMITER.limit).mockResolvedValue({ success: false })
    const response = await handleRpcProxy(request(call('getSlot')), env)
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')
    expect(upstream).not.toHaveBeenCalled()
  })
  it('rejects oversized and malformed JSON without forwarding it', async () => {
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)
    expect(
      (
        await handleRpcProxy(
          request(call('getSlot', ['x'.repeat(65536)])),
          makeEnv(),
        )
      ).status,
    ).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })
  it('fails closed when production secrets are missing', async () => {
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)
    expect(
      (
        await handleRpcProxy(request(call('getSlot')), {
          ...makeEnv(),
          SOLANA_RPC_URL: '',
        })
      ).status,
    ).toBe(502)
    expect(upstream).not.toHaveBeenCalled()
  })
  it.each([
    () =>
      Response.json({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32000, message: secret, data: secret },
      }),
    () => new Response(secret, { status: 302, headers: { Location: secret } }),
    () => new Response(secret, { status: 500 }),
    () =>
      Response.json({
        jsonrpc: '2.0',
        id: 1,
        result: 'x'.repeat(4 * 1024 * 1024),
      }),
  ])(
    'does not leak provider errors, redirects or excessive responses',
    async (response) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()))
      const result = await handleRpcProxy(request(call('getSlot')), makeEnv())
      expect(await result.text()).not.toContain('private-provider-token')
      expect(result.headers.get('Location')).toBeNull()
    },
  )
})

describe('RPC method policy', () => {
  const allowed = (value: unknown, transport: 'http' | 'websocket' = 'http') =>
    validateRpcPayload(value, transport, target.programId, true)
  it('bounds batches and account scans to this program', () => {
    expect(allowed([])).toBe(false)
    expect(allowed(Array.from({ length: 11 }, () => call('getSlot')))).toBe(
      false,
    )
    expect(allowed([call('getSlot'), call('requestAirdrop')])).toBe(false)
    expect(allowed(call('getProgramAccounts', [target.programId]))).toBe(true)
    expect(allowed(call('getProgramAccounts', ['unrelated']))).toBe(false)
    expect(
      allowed(call('getMultipleAccounts', [Array(101).fill('account')])),
    ).toBe(false)
  })
  it('allows subscriptions without opening arbitrary provider methods', () => {
    expect(allowed(call('accountSubscribe', ['account']), 'websocket')).toBe(
      true,
    )
    expect(allowed(call('signatureUnsubscribe', [1]), 'websocket')).toBe(true)
    expect(allowed(call('programSubscribe', ['unrelated']), 'websocket')).toBe(
      false,
    )
    expect(allowed(call('sendTransaction'), 'websocket')).toBe(false)
    expect(allowed(call('slotSubscribe'))).toBe(false)
  })
  it('preserves notification and result payloads while stripping provider error details', () => {
    const notification = {
      jsonrpc: '2.0',
      method: 'accountNotification',
      params: { subscription: 1, result: { value: 123 } },
    }
    expect(sanitizeRpcResponse(notification)).toEqual(notification)
    expect(
      sanitizeRpcResponse([
        { jsonrpc: '2.0', id: 1, error: { code: -1, message: secret } },
      ]),
    ).toEqual([
      {
        jsonrpc: '2.0',
        id: 1,
        error: { code: -1, message: 'Solana RPC request failed' },
      },
    ])
  })
})

describe('RPC preflight error sanitization', () => {
  const preflightFailure = (err: unknown) => ({
    jsonrpc: '2.0',
    id: 1,
    error: {
      code: -32002,
      message: secret,
      data: {
        err,
        logs: [secret],
        provider: secret,
        returnData: { data: [secret, 'base64'] },
      },
    },
  })

  it.each([
    'InsufficientFundsForFee',
    'BlockhashNotFound',
    { InstructionError: [0, { Custom: 6006 }] },
    { InstructionError: [2, 'InsufficientFunds'] },
    { InstructionError: [2, { Custom: 0 }] },
    { DuplicateInstruction: 1 },
    { InsufficientFundsForRent: { account_index: 2 } },
    { ProgramExecutionTemporarilyRestricted: { account_index: 3 } },
  ])('preserves a supported transaction error: %j', (err) => {
    const sanitized = sanitizeRpcResponse(preflightFailure(err)) as {
      error: { data: { err: unknown } }
    }
    expect(sanitized).toEqual({
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: -32002,
        message: 'Solana RPC request failed',
        data: { err },
      },
    })
    expect(
      isSolanaError(
        getSolanaErrorFromJsonRpcError(sanitized.error),
        SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
      ),
    ).toBe(true)
  })

  it.each([
    undefined,
    null,
    secret,
    'UnknownProviderError',
    'InsufficientFundsForRent',
    'ProgramExecutionTemporarilyRestricted',
    'DuplicateInstruction',
    { InstructionError: null },
    { InstructionError: [0] },
    { InstructionError: [256, 'InsufficientFunds'] },
    { InstructionError: [0, secret] },
    { InstructionError: [0, 'Custom'] },
    { InstructionError: [0, { Custom: secret }] },
    { InstructionError: [0, { Custom: -1 }] },
    { InstructionError: [0, { Custom: 0x100000000 }] },
    { InstructionError: [0, { Custom: 6006, provider: secret }] },
    { InsufficientFundsForRent: { account_index: secret } },
    { UnknownProviderError: secret },
  ])('drops unsupported or malformed error details: %j', (err) => {
    const sanitized = sanitizeRpcResponse(preflightFailure(err)) as {
      error: { data: { err: unknown } }
    }
    expect(sanitized.error.data).toEqual({ err: null })
    expect(JSON.stringify(sanitized)).not.toContain('private-provider-token')
    expect(
      isSolanaError(
        getSolanaErrorFromJsonRpcError(sanitized.error),
        SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
      ),
    ).toBe(true)
  })

  it('retains Borsh failure identity without its free-form text', () => {
    expect(
      sanitizeRpcResponse(
        preflightFailure({ InstructionError: [0, { BorshIoError: secret }] }),
      ),
    ).toMatchObject({
      error: { data: { err: { InstructionError: [0, 'BorshIoError'] } } },
    })
  })
})
