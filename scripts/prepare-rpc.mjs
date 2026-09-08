import { mkdir, writeFile } from 'node:fs/promises'
import { loadEnv } from 'vite'

// Keep provider credentials in ignored local files and Cloudflare secret bindings.
const env = loadEnv('production', process.cwd(), '')
const secrets = {}
for (const [name, protocol] of [
  ['SOLANA_RPC_URL', 'https:'],
  ['SOLANA_WS_URL', 'wss:'],
]) {
  const value = env[name]?.trim()
  if (!value) throw new Error(`Set ${name} in .env.production.local`)
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be a valid URL`)
  }
  if (url.protocol !== protocol || url.username || url.password || url.hash)
    throw new Error(
      `${name} requires ${protocol} without user information or fragments`,
    )
  secrets[name] = value
}
await mkdir('.cloudflare', { recursive: true })
await writeFile('.cloudflare/rpc-secrets.json', JSON.stringify(secrets), {
  mode: 0o600,
})
await writeFile(
  '.dev.vars.production',
  Object.entries(secrets)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join('\n') + '\n',
  { mode: 0o600 },
)
console.log('Prepared ignored RPC secret files. No provider values printed.')
