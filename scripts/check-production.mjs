import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

// Exercise the built Worker: compilation alone does not catch SSR serialization failures.
const port = process.env.MATO_SMOKE_PORT ?? '4174'
const origin = `http://127.0.0.1:${port}`
const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    port,
    '--strictPort',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
)
let output = ''
let stopped = false
const exited = new Promise((resolve) => {
  server.once('exit', () => {
    stopped = true
    resolve()
  })
  server.once('error', (error) => {
    output += error.message
    stopped = true
    resolve()
  })
})
for (const stream of [server.stdout, server.stderr]) {
  stream.on('data', (chunk) => {
    output = (output + chunk.toString()).slice(-12000)
  })
}

async function request(path) {
  return fetch(`${origin}${path}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(5000),
  })
}

try {
  const deadline = Date.now() + 30000
  while (true) {
    assert.ok(!stopped, 'Production preview exited before becoming ready')
    try {
      const response = await request('/healthz')
      assert.equal(response.status, 200)
      const health = await response.json()
      assert.equal(health.status, 'ok')
      break
    } catch {
      assert.ok(
        Date.now() < deadline,
        'Production preview did not become ready',
      )
      await delay(250)
    }
  }

  for (const [path, content] of [
    ['/', 'Give your'],
    ['/trade?market=1', 'Trade SOL/USDC'],
    ['/rent', 'Rent accounts'],
  ]) {
    const response = await request(path)
    assert.equal(response.status, 200, `${path} must render successfully`)
    assert.match(response.headers.get('content-type') ?? '', /text\/html/)
    const html = await response.text()
    const text = html.replace(/<[^>]*>/g, '')
    assert.ok(text.includes(content), `${path} must contain its page content`)
    assert.ok(html.includes('</html>'), `${path} must finish rendering`)
    console.log(`Production page passed: ${path}`)
  }

  for (const [path, status, destination] of [
    ['/welcome', 301, '/'],
    ['/?market=1', 307, '/trade?market=1'],
  ]) {
    const response = await request(path)
    assert.equal(response.status, status, `${path} must redirect`)
    const location = new URL(response.headers.get('location'), origin)
    assert.equal(location.pathname + location.search, destination)
    await response.body?.cancel()
    console.log(`Production redirect passed: ${path}`)
  }
} catch (error) {
  console.error(output)
  console.error(error)
  process.exitCode = 1
} finally {
  if (!stopped) {
    server.kill('SIGTERM')
    const forceStop = setTimeout(() => server.kill('SIGKILL'), 5000)
    forceStop.unref()
    await exited
    clearTimeout(forceStop)
  }
}
