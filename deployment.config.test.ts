import { describe, expect, it } from 'vitest'
import { deploymentEnvironment } from './deployment.config'
import target from './deployment-target.json'

const configured = { VITE_READ_API_URL: 'https://read.example.com' }
describe('deployment configuration', () => {
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
    ).toThrow('VITE_SOLANA_RPC_URL requires https:')
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
  it('derives secure WebSockets and fixes the site URL to the branch target', () => {
    const result = deploymentEnvironment('production', {
      ...configured,
      VITE_SOLANA_RPC_URL: 'https://rpc.example.com/?token=public',
      VITE_SITE_URL: 'https://wrong.example.com',
    })
    expect(result.VITE_SOLANA_WS_URL).toBe(
      'wss://rpc.example.com/?token=public',
    )
    expect(result.VITE_SITE_URL).toBe(target.siteUrl)
  })
})
