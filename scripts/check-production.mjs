import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { JSDOM } from 'jsdom'

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
    ['/', 'The DCA that prices'],
    ['/trade?market=1', 'Trade SOL/USDC'],
    ['/rent', 'Rent accounts'],
    ['/terms', 'Terms of Service'],
    ['/privacy', 'Privacy Notice'],
  ]) {
    const response = await request(path)
    assert.equal(response.status, 200, `${path} must render successfully`)
    assert.match(response.headers.get('content-type') ?? '', /text\/html/)
    const html = await response.text()
    const text = html.replace(/<[^>]*>/g, '')
    assert.ok(text.includes(content), `${path} must contain its page content`)
    assert.ok(html.includes('</html>'), `${path} must finish rendering`)
    if (path === '/') {
      const document = new JSDOM(html).window.document
      assert.equal(document.querySelectorAll('h1').length, 1)
      const meta = (selector) => {
        const elements = document.querySelectorAll(selector)
        assert.equal(elements.length, 1, `${selector} must not be duplicated`)
        return elements[0].getAttribute('content')
      }
      assert.equal(meta('meta[name="twitter:card"]'), 'summary_large_image')
      const image = meta('meta[property="og:image"]')
      assert.equal(image, meta('meta[name="twitter:image"]'))
      assert.equal(new URL(image).pathname, '/mato-social-card.png')
      const schemas = [
        ...document.querySelectorAll('script[type="application/ld+json"]'),
      ].map((script) => JSON.parse(script.textContent))
      const organization = schemas.find(
        (schema) => schema['@type'] === 'Organization',
      )
      assert.equal(organization?.name, 'Mato')
      const faq = schemas.find((schema) => schema['@type'] === 'FAQPage')
      const visibleFaqs = [...document.querySelectorAll('.faq-list details')]
      assert.equal(faq?.mainEntity.length, visibleFaqs.length)
      assert.ok(visibleFaqs.length > 0)
      const normalize = (value) => value.replace(/\s+/g, ' ').trim()
      visibleFaqs.forEach((entry, index) => {
        assert.equal(
          normalize(faq.mainEntity[index].name),
          normalize(entry.querySelector('summary').textContent),
        )
        assert.equal(
          normalize(faq.mainEntity[index].acceptedAnswer.text),
          normalize(entry.querySelector('p').textContent),
        )
      })
      const durations = [
        ...document.querySelectorAll('.stream-duration button'),
      ].map((button) => button.textContent)
      assert.deepEqual(durations, ['1 day', '1 week', '1 month'])
    }
    if (path === '/terms' || path === '/privacy') {
      assert.ok(
        !text.includes('Connect wallet'),
        `${path} must not render the trading shell`,
      )
    }
    console.log(`Production page passed: ${path}`)
  }

  for (const path of ['/sitemap.xml', '/llms.txt', '/mato-social-card.png']) {
    const response = await request(path)
    assert.equal(response.status, 200, `${path} must be accessible to crawlers`)
    if (path.endsWith('.png')) {
      assert.match(response.headers.get('content-type') ?? '', /image\/png/)
      const bytes = Buffer.from(await response.arrayBuffer())
      assert.equal(bytes.readUInt32BE(16), 1200)
      assert.equal(bytes.readUInt32BE(20), 630)
    } else {
      const body = await response.text()
      assert.ok(
        !body.includes('<!DOCTYPE html>'),
        `${path} must not be an HTML fallback`,
      )
      if (path.endsWith('.xml')) {
        const document = new JSDOM(body, { contentType: 'text/xml' }).window
          .document
        assert.deepEqual(
          [...document.querySelectorAll('loc')].map((node) => node.textContent),
          [
            'https://mato.markets/',
            'https://mato.markets/trade',
            'https://mato.markets/terms',
            'https://mato.markets/privacy',
          ],
        )
      } else {
        assert.ok(body.startsWith('# Mato'))
      }
    }
    console.log(`Production crawler asset passed: ${path}`)
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
