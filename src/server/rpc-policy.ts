import {
  SOLANA_ERROR__INSTRUCTION_ERROR__UNKNOWN,
  SOLANA_ERROR__TRANSACTION_ERROR__UNKNOWN,
  getSolanaErrorFromInstructionError,
  getSolanaErrorFromTransactionError,
  isSolanaError,
} from '@solana/kit'

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
  // Align market price history with the position start time.
  'getBlockTime',
  // Used by the client's blockhash-expiry check during confirmation.
  'getEpochInfo',
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isUnsignedInteger(value: unknown, max: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= max
  )
}

// Reconstruct only known Solana enum variants and numeric fields. Never forward
// arbitrary provider strings, logs, or metadata from error.data.
function sanitizeTransactionError(value: unknown): unknown {
  if (typeof value === 'string') {
    if (
      [
        'InstructionError',
        'DuplicateInstruction',
        'InsufficientFundsForRent',
        'ProgramExecutionTemporarilyRestricted',
      ].includes(value)
    )
      return null
    return isSolanaError(
      getSolanaErrorFromTransactionError(value),
      SOLANA_ERROR__TRANSACTION_ERROR__UNKNOWN,
    )
      ? null
      : value
  }
  if (!isRecord(value) || Object.keys(value).length !== 1) return null

  const instruction = value.InstructionError
  if (
    Array.isArray(instruction) &&
    instruction.length === 2 &&
    isUnsignedInteger(instruction[0], 255)
  ) {
    const [index, detail] = instruction
    if (typeof detail === 'string' && detail !== 'Custom') {
      return isSolanaError(
        getSolanaErrorFromInstructionError(index, detail),
        SOLANA_ERROR__INSTRUCTION_ERROR__UNKNOWN,
      )
        ? null
        : { InstructionError: [index, detail] }
    }
    if (isRecord(detail) && Object.keys(detail).length === 1) {
      if (isUnsignedInteger(detail.Custom, 0xffffffff))
        return { InstructionError: [index, { Custom: detail.Custom }] }
      if (typeof detail.BorshIoError === 'string')
        return { InstructionError: [index, 'BorshIoError'] }
    }
    return null
  }

  if (isUnsignedInteger(value.DuplicateInstruction, 255))
    return { DuplicateInstruction: value.DuplicateInstruction }
  for (const name of [
    'InsufficientFundsForRent',
    'ProgramExecutionTemporarilyRestricted',
  ]) {
    const detail = value[name]
    if (isRecord(detail) && isUnsignedInteger(detail.account_index, 255))
      return { [name]: { account_index: detail.account_index } }
  }
  return null
}

// Provider messages can contain private endpoint details. Preflight failures
// also need a data object: Solana Kit destructures data.err for code -32002.
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
        ...(error.code === -32002
          ? {
              data: {
                err: sanitizeTransactionError(
                  isRecord(error.data) ? error.data.err : null,
                ),
              },
            }
          : {}),
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
