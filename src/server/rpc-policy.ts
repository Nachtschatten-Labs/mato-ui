const READ_METHODS = new Set([
  'getAccountInfo',
  'getMultipleAccounts',
  'getBalance',
  'getTokenAccountsByOwner',
  'getTokenAccountBalance',
  'getMinimumBalanceForRentExemption',
  'getLatestBlockhash',
  'getGenesisHash',
  'getVersion',
  'getSlot',
  'getBlockHeight',
  'getSignatureStatuses',
  'getRecentPrioritizationFees',
  'getFeeForMessage',
  'isBlockhashValid',
  'getProgramAccounts',
  'simulateTransaction',
])
const SUBSCRIPTION_METHODS = new Set([
  'accountSubscribe',
  'accountUnsubscribe',
  'programSubscribe',
  'programUnsubscribe',
  'signatureSubscribe',
  'signatureUnsubscribe',
  'slotSubscribe',
  'slotUnsubscribe',
  'rootSubscribe',
  'rootUnsubscribe',
])

export function validateRpcPayload(
  value: unknown,
  transport: 'http' | 'websocket',
  programId: string,
  tradingEnabled: boolean,
): boolean {
  const requests = Array.isArray(value) ? value : [value]
  if (requests.length === 0 || requests.length > 10) return false
  return requests.every((request: unknown) => {
    if (!request || typeof request !== 'object' || Array.isArray(request))
      return false
    const call = request as Record<string, unknown>
    if (call.jsonrpc !== '2.0' || typeof call.method !== 'string') return false
    if (typeof call.id !== 'string' && typeof call.id !== 'number') return false
    if (typeof call.id === 'string' && call.id.length > 200) return false
    if (call.params !== undefined && !Array.isArray(call.params)) return false
    const allowed =
      transport === 'websocket'
        ? SUBSCRIPTION_METHODS.has(call.method)
        : READ_METHODS.has(call.method) ||
          (tradingEnabled && call.method === 'sendTransaction')
    if (!allowed) return false
    const params = Array.isArray(call.params) ? call.params : []
    if (
      call.method === 'getProgramAccounts' ||
      call.method === 'programSubscribe'
    ) {
      if (params[0] !== programId) return false
    }
    if (
      call.method === 'getMultipleAccounts' &&
      (!Array.isArray(params[0]) || params[0].length > 100)
    )
      return false
    return true
  })
}

// Provider errors can contain private endpoint details. Preserve RPC codes only.
export function sanitizeRpcResponse(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeRpcResponse)
  if (!value || typeof value !== 'object')
    throw new Error('Invalid RPC response')
  const response = value as Record<string, unknown>
  if (response.jsonrpc !== '2.0') throw new Error('Invalid RPC response')
  if (response.error) {
    const error = response.error as Record<string, unknown>
    return {
      jsonrpc: '2.0',
      id: response.id ?? null,
      error: {
        code: typeof error.code === 'number' ? error.code : -32000,
        message: 'Solana RPC request failed',
      },
    }
  }
  if ('result' in response)
    return { jsonrpc: '2.0', id: response.id, result: response.result }
  if (
    typeof response.method === 'string' &&
    response.method.endsWith('Notification')
  ) {
    return { jsonrpc: '2.0', method: response.method, params: response.params }
  }
  throw new Error('Invalid RPC response')
}
