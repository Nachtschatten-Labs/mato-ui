import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadEnv } from 'vite'

const env = loadEnv('production', process.cwd(), '')
const privateMarkers = []
for (const name of ['SOLANA_RPC_URL', 'SOLANA_WS_URL']) {
  if (!env[name]) continue
  const url = new URL(env[name])
  // Public default origins contain no credentials. Inspect path/query tokens too.
  privateMarkers.push(
    ...url.pathname.split('/').filter((part) => part.length >= 12),
  )
  for (const value of url.searchParams.values())
    if (value) privateMarkers.push(value)
  if (url.pathname !== '/' || url.search) privateMarkers.push(url.toString())
}
let checked = 0
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await scan(path)
    else if (/\.(?:js|css|html|map|json)$/.test(entry.name)) {
      const contents = await readFile(path, 'utf8')
      if (privateMarkers.some((marker) => contents.includes(marker)))
        throw new Error(`Private RPC configuration found in ${path}`)
      checked++
    }
  }
}
await scan('dist/client')
await scan('dist/server')
console.log(`RPC credential scan passed for ${checked} build files.`)
