import {
  confirmationMeetsCommitment,
  deriveConfirmationStatus,
  normalizeSignature,
} from '@solana/client'
import {
  isSolanaError,
  SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR,
} from '@solana/kit'
import type { SolanaClient } from '@solana/client'

const CONFIRMATION_TIMEOUT_MS = 120_000
const POLL_INTERVAL_MS = 1_000

export class TransactionConfirmationUnknownError extends Error {
  constructor(
    readonly signature: string,
    cause?: unknown,
  ) {
    super(
      'The transaction was submitted, but confirmation is unavailable. Check the transaction in the explorer before trying again.',
      { cause },
    )
    this.name = 'TransactionConfirmationUnknownError'
  }
}

export function isRpcRateLimitError(error: unknown) {
  return (
    isSolanaError(error, SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR) &&
    error.context.statusCode === 429
  )
}

function retryDelay(error: unknown) {
  if (!isSolanaError(error, SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR)) {
    return POLL_INTERVAL_MS
  }
  const value = error.context.headers?.get('Retry-After')
  if (!value) return 5_000
  const seconds = Number(value)
  const delay = Number.isFinite(seconds)
    ? seconds * 1_000
    : Date.parse(value) - Date.now()
  return Number.isFinite(delay) ? Math.max(POLL_INTERVAL_MS, delay) : 5_000
}

export async function waitForConfirmedSignature(
  rpc: SolanaClient['runtime']['rpc'],
  signature: string,
) {
  const normalizedSignature = normalizeSignature(signature)
  if (!normalizedSignature) {
    throw new Error('Invalid transaction signature returned by wallet.')
  }
  const deadline = Date.now() + CONFIRMATION_TIMEOUT_MS
  let lastError: unknown

  while (Date.now() < deadline) {
    let delay = POLL_INTERVAL_MS
    let status
    try {
      const response = await rpc
        .getSignatureStatuses([normalizedSignature])
        .send({
          abortSignal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
        })
      status = response.value[0] ?? null
    } catch (error) {
      lastError = error
      if (!isRpcRateLimitError(error)) {
        throw new TransactionConfirmationUnknownError(signature, error)
      }
      delay = retryDelay(error)
    }

    // Only a status returned by Solana can establish transaction failure.
    if (status?.err) {
      throw new Error(
        `Transaction failed during confirmation: ${JSON.stringify(status.err)}`,
      )
    }
    if (
      confirmationMeetsCommitment(
        deriveConfirmationStatus(status ?? null),
        'confirmed',
      )
    ) {
      return
    }

    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(delay, remaining)),
    )
  }

  throw new TransactionConfirmationUnknownError(signature, lastError)
}
