import target from './deployment-target.json' with { type: 'json' }

type Env = Record<string, string | undefined>

export function deploymentEnvironment(mode: string, input: Env) {
  const production = mode === 'production'
  const env: Record<string, string> = {
    VITE_SITE_URL: target.siteUrl,
    VITE_DEPLOYMENT_MODE: production ? 'production' : 'preview',
    VITE_READ_API_URL: input.VITE_READ_API_URL?.trim() ?? '',
    VITE_SOLANA_RPC_URL:
      input.VITE_SOLANA_RPC_URL?.trim() || target.defaultRpcUrl,
    VITE_SOLANA_WS_URL:
      input.VITE_SOLANA_WS_URL?.trim() ||
      (input.VITE_SOLANA_RPC_URL?.trim() || target.defaultRpcUrl).replace(
        /^https:/,
        'wss:',
      ),
    VITE_MARKET_ID: input.VITE_MARKET_ID?.trim() || '1',
    VITE_ENABLE_TRANSACTIONS: production
      ? input.VITE_ENABLE_TRANSACTIONS || 'false'
      : 'false',
    VITE_VERIFIED_PROGRAM_ID: production
      ? input.VITE_VERIFIED_PROGRAM_ID || ''
      : '',
  }
  if (production && !env.VITE_READ_API_URL) {
    throw new Error(
      'Production requires VITE_READ_API_URL. Use build:preview for an unconfigured preview.',
    )
  }
  for (const [key, protocol] of [
    ['VITE_READ_API_URL', 'https:'],
    ['VITE_SOLANA_RPC_URL', 'https:'],
    ['VITE_SOLANA_WS_URL', 'wss:'],
  ] as const) {
    if (!env[key]) continue
    let url: URL
    try {
      url = new URL(env[key])
    } catch {
      throw new Error(`${key} must be a valid ${protocol} URL`)
    }
    if (
      url.protocol !== protocol ||
      url.username ||
      url.password ||
      url.hash ||
      (key === 'VITE_READ_API_URL' && url.search)
    ) {
      throw new Error(
        `${key} requires ${protocol} without embedded credentials, fragments, or read-API query parameters`,
      )
    }
  }
  if (!['true', 'false'].includes(env.VITE_ENABLE_TRANSACTIONS)) {
    throw new Error('VITE_ENABLE_TRANSACTIONS must be true or false')
  }
  if (
    env.VITE_ENABLE_TRANSACTIONS === 'true' &&
    env.VITE_VERIFIED_PROGRAM_ID !== target.programId
  ) {
    throw new Error(
      'Enabled trading requires the verified program ID for this branch',
    )
  }
  if (
    !/^\d+$/.test(env.VITE_MARKET_ID) ||
    Number(env.VITE_MARKET_ID) < 1 ||
    !Number.isSafeInteger(Number(env.VITE_MARKET_ID)) ||
    (target.branch === 'v1' && Number(env.VITE_MARKET_ID) > 4)
  ) {
    throw new Error('VITE_MARKET_ID is not supported by this branch')
  }
  return env
}
