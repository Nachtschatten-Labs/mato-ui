import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SolanaError,
  SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR,
} from '@solana/kit'
import {
  TransactionConfirmationUnknownError,
  waitForConfirmedSignature,
} from './transaction-confirmation'
import type { SolanaClient } from '@solana/client'

const signature = '1'.repeat(64)
const confirmed = { value: [{ err: null, confirmationStatus: 'confirmed' }] }
const rateLimit = (retryAfter = '60') =>
  new SolanaError(SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR, {
    statusCode: 429,
    headers: new Headers({ 'Retry-After': retryAfter }),
    message: '',
  })

function mockRpc(send: ReturnType<typeof vi.fn>) {
  return {
    getSignatureStatuses: vi.fn(() => ({ send })),
  } as unknown as SolanaClient['runtime']['rpc']
}

describe('transaction confirmation', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('waits for Retry-After then confirms the same signature without resubmitting', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(rateLimit())
      .mockResolvedValue(confirmed)
    const rpc = mockRpc(send)
    const confirmation = waitForConfirmedSignature(rpc, signature)
    await vi.advanceTimersByTimeAsync(59_999)
    expect(send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await expect(confirmation).resolves.toBeUndefined()
    expect(send).toHaveBeenCalledTimes(2)
    expect(rpc.getSignatureStatuses).toHaveBeenNthCalledWith(2, [signature])
  })

  it('supports an HTTP-date Retry-After', async () => {
    vi.setSystemTime(new Date('2026-09-08T12:00:00Z'))
    const send = vi
      .fn()
      .mockRejectedValueOnce(rateLimit('Tue, 08 Sep 2026 12:01:00 GMT'))
      .mockResolvedValue(confirmed)
    const confirmation = waitForConfirmedSignature(mockRpc(send), signature)
    await vi.advanceTimersByTimeAsync(60_000)
    await expect(confirmation).resolves.toBeUndefined()
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('retains the submitted signature when rate limiting outlasts the confirmation window', async () => {
    const send = vi.fn().mockRejectedValue(rateLimit())
    const outcome = waitForConfirmedSignature(mockRpc(send), signature).catch(
      (error) => error,
    )
    await vi.advanceTimersByTimeAsync(120_000)
    const error = await outcome
    expect(error).toBeInstanceOf(TransactionConfirmationUnknownError)
    expect(error.signature).toBe(signature)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('keeps an on-chain failure distinct from a rate-limited confirmation', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(rateLimit('1'))
      .mockResolvedValue({
        value: [{ err: { InstructionError: [0, { Custom: 6006 }] } }],
      })
    const outcome = waitForConfirmedSignature(mockRpc(send), signature).catch(
      (error) => error,
    )
    await vi.advanceTimersByTimeAsync(1_000)
    const error = await outcome
    expect(error).not.toBeInstanceOf(TransactionConfirmationUnknownError)
    expect(error.message).toContain('Transaction failed during confirmation')
  })

  it('does not call a connection failure a failed transaction', async () => {
    const send = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(
      waitForConfirmedSignature(mockRpc(send), signature),
    ).rejects.toMatchObject({
      name: 'TransactionConfirmationUnknownError',
      signature,
    })
  })

  it('treats absent statuses as unconfirmed after the deadline', async () => {
    const send = vi.fn().mockResolvedValue({ value: [null] })
    const outcome = waitForConfirmedSignature(mockRpc(send), signature).catch(
      (error) => error,
    )
    await vi.advanceTimersByTimeAsync(120_000)
    expect(await outcome).toBeInstanceOf(TransactionConfirmationUnknownError)
  })
})
