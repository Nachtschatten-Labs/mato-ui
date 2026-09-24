import { describe, expect, it } from 'vitest'
import {
  formatExplorerAddressUrl,
  formatExplorerTransactionUrl,
} from './format'

describe('Explorer links', () => {
  it.each([
    'http://localhost:3000/rpc',
    'http://127.0.0.1:3000/rpc',
    'https://devnet.mato.markets/rpc',
  ])('links to devnet when using the RPC facade at %s', (endpoint) => {
    expect(formatExplorerTransactionUrl('signature', endpoint)).toBe(
      'https://explorer.solana.com/tx/signature?cluster=devnet',
    )
    expect(formatExplorerAddressUrl('address', endpoint)).toBe(
      'https://explorer.solana.com/address/address?cluster=devnet',
    )
  })
})
