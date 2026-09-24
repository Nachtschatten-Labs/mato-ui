import { describe, expect, it } from 'vitest'
import { deploymentEnvironment } from './deployment.config'
import target from './deployment-target.json'
import { TWOB_ANCHOR_PROGRAM_ADDRESS } from './src/lib/generated/twob/src/generated/programs'

const configured = { VITE_READ_API_URL: 'https://read.example.com' }
describe('deployment configuration', () => {
  it('uses the same program for server RPC scans and the generated client', () => {
    expect(target.programId).toBe(TWOB_ANCHOR_PROGRAM_ADDRESS)
  })
  it('allows production trading with the verified dedicated-market program', () => {
    const result = deploymentEnvironment('production', {
      ...configured,
      VITE_ENABLE_TRANSACTIONS: 'true',
      VITE_VERIFIED_PROGRAM_ID: TWOB_ANCHOR_PROGRAM_ADDRESS,
    })
    expect(result.VITE_ENABLE_TRANSACTIONS).toBe('true')
    expect(result.VITE_VERIFIED_PROGRAM_ID).toBe(TWOB_ANCHOR_PROGRAM_ADDRESS)
  })
  it('rejects the previous program when enabling production trading', () => {
    expect(() =>
      deploymentEnvironment('production', {
        ...configured,
        VITE_ENABLE_TRANSACTIONS: 'true',
        VITE_VERIFIED_PROGRAM_ID:
          'CCAd78ZgUBAFNQmCCD5z4oGuFzb8uXLw5kfnBcRvDw16',
      }),
    ).toThrow('verified program ID')
  })
  it('fails closed when production has no read API', () => {
    expect(() => deploymentEnvironment('production', {})).toThrow(
      'requires VITE_READ_API_URL',
    )
  })
  it('keeps previews read-only even when the shell enables trading', () => {
    const result = deploymentEnvironment('preview', {
      VITE_ENABLE_TRANSACTIONS: 'true',
      VITE_VERIFIED_PROGRAM_ID: target.programId,
    })
    expect(result.VITE_ENABLE_TRANSACTIONS).toBe('false')
    expect(result.VITE_VERIFIED_PROGRAM_ID).toBe('')
  })
  it.each([
    'http://read.example.com',
    'https://user:password@read.example.com',
    'https://read.example.com?key=value',
    'https://read.example.com/#fragment',
  ])('rejects an unsafe or incompatible read endpoint: %s', (value) => {
    expect(() =>
      deploymentEnvironment('production', { VITE_READ_API_URL: value }),
    ).toThrow()
  })
  it('does not disclose endpoint credentials in configuration errors', () => {
    expect(() =>
      deploymentEnvironment('production', {
        VITE_SOLANA_RPC_URL: 'http://rpc.example.com?secret=do-not-log',
        ...configured,
      }),
    ).toThrow('server-only SOLANA_RPC_URL')
  })
  it('requires a matching program before allowing trading', () => {
    expect(() =>
      deploymentEnvironment('production', {
        ...configured,
        VITE_ENABLE_TRANSACTIONS: 'true',
        VITE_VERIFIED_PROGRAM_ID: 'wrong',
      }),
    ).toThrow('verified program ID')
  })
  it('keeps private RPC configuration out of the browser and fixes the site URL', () => {
    const result = deploymentEnvironment('production', {
      ...configured,
      SOLANA_RPC_URL: 'https://rpc.example.com/private-token',
      SOLANA_WS_URL: 'wss://rpc.example.com/private-token',
      VITE_SITE_URL: 'https://wrong.example.com',
    })
    expect(result.VITE_SOLANA_WS_URL).toBe(
      target.siteUrl.replace('https:', 'wss:') + '/rpc/ws',
    )
    expect(result.VITE_SITE_URL).toBe(target.siteUrl)
    expect(result.VITE_SOLANA_RPC_URL).toBe(target.siteUrl + '/rpc')
    expect(JSON.stringify(result)).not.toContain('private-token')
  })
})
