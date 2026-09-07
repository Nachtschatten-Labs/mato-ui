import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertTransactionsEnabled } from './transaction-policy'
import { TWOB_ANCHOR_PROGRAM_ADDRESS } from '@/lib/generated/twob/src/generated/programs'
import * as trading from '@/features/trading/api/twob-client'

afterEach(() => vi.unstubAllEnvs())

describe('recovered transaction boundary', () => {
  it('blocks every transaction entry point before touching wallet or RPC', async () => {
    vi.stubEnv('VITE_ENABLE_TRANSACTIONS', 'false')
    const entryPoints = Object.entries(trading).filter(([name]) =>
      name.startsWith('send'),
    )
    expect(entryPoints.length).toBeGreaterThanOrEqual(4)
    for (const [, send] of entryPoints) {
      await expect(
        (send as (request: object) => Promise<unknown>)({}),
      ).rejects.toThrow('Trading is disabled')
    }
  })

  it('rejects an enabled flag with a different program ID', () => {
    vi.stubEnv('VITE_ENABLE_TRANSACTIONS', 'true')
    vi.stubEnv('VITE_VERIFIED_PROGRAM_ID', '11111111111111111111111111111111')
    expect(assertTransactionsEnabled).toThrow('Trading is disabled')
  })

  it('requires both explicit enablement and the reviewed program ID', () => {
    vi.stubEnv('VITE_ENABLE_TRANSACTIONS', 'true')
    vi.stubEnv('VITE_VERIFIED_PROGRAM_ID', TWOB_ANCHOR_PROGRAM_ADDRESS)
    expect(assertTransactionsEnabled).not.toThrow()
  })
})
