// A targeted regression check for this incident, not a comprehensive malware audit.
// This parses source as data; it never imports application files or project configs.
import { readdirSync, readFileSync, lstatSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const packages = new Set(
  Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }),
)
const findings = []
let count = 0

for (const entry of readdirSync(root)) {
  if (
    /^(?:prettier\.config\.|\.prettierrc\.(?:js|cjs|mjs)$|eslint\.config\.|\.pnpmfile\.|\.npmrc$|\.gitmodules$|\.claude$)/.test(
      entry,
    )
  ) {
    findings.push(
      `${entry}: executable configuration or automation requires an explicit security review`,
    )
  }
}
for (const name of Object.keys(manifest.scripts ?? {})) {
  if (
    /^(?:pre|post)(?:install|build|dev|test|publish|pack)$|^(?:install|prepare)$/.test(
      name,
    )
  ) {
    findings.push(
      `package.json: automatic lifecycle script ${name} requires review`,
    )
  }
}
for (const [name, version] of Object.entries({
  ...manifest.dependencies,
  ...manifest.devDependencies,
})) {
  if (!/^\d+\.\d+\.\d+$/.test(version))
    findings.push(`package.json: ${name} must use an exact registry version`)
}

function visitDirectory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    const name = relative(root, path).replaceAll('\\', '/')
    if (lstatSync(path).isSymbolicLink()) {
      findings.push(
        `${name}: symbolic links are not allowed in recovered source`,
      )
      continue
    }
    if (entry.isDirectory()) {
      visitDirectory(path)
      continue
    }
    if (!/\.(tsx?|css|json)$/.test(name)) {
      findings.push(`${name}: unexpected source file type`)
      continue
    }
    const text = readFileSync(path, 'utf8')
    count++
    if (
      /[^\S\n]{120,}|[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(
        text,
      )
    ) {
      findings.push(
        `${name}: hidden padding or invisible directional characters`,
      )
    }
    if (!/\.tsx?$/.test(name)) continue
    const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true)
    function flag(node, message) {
      const { line } = source.getLineAndCharacterOfPosition(
        node.getStart(source),
      )
      findings.push(`${name}:${line + 1}: ${message}`)
    }
    function checkModule(node) {
      if (!ts.isStringLiteralLike(node)) {
        flag(node, 'nonliteral module loading requires review')
        return
      }
      const value = node.text
      if (value.startsWith('.') || value.startsWith('@/')) return
      const name = value.startsWith('@')
        ? value.split('/').slice(0, 2).join('/')
        : value.split('/')[0]
      if (!packages.has(name)) flag(node, `unapproved module: ${value}`)
    }
    function walk(node) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier
      ) {
        checkModule(node.moduleSpecifier)
      }
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword
      ) {
        checkModule(node.arguments[0])
      }
      if (
        ts.isIdentifier(node) &&
        [
          'eval',
          'Function',
          'require',
          'child_process',
          'Deno',
          'Bun',
        ].includes(node.text)
      ) {
        flag(node, `unexpected execution API: ${node.text}`)
      }
      if (
        (ts.isPropertyAccessExpression(node) &&
          node.name.text === 'constructor') ||
        (ts.isElementAccessExpression(node) &&
          ts.isStringLiteralLike(node.argumentExpression) &&
          node.argumentExpression.text === 'constructor')
      ) {
        flag(node, 'constructor property access requires review')
      }
      if (
        ts.isIdentifier(node) &&
        [
          'fetch',
          'EventSource',
          'WebSocket',
          'XMLHttpRequest',
          'sendBeacon',
        ].includes(node.text) &&
        !name.includes('.test.') &&
        name !== 'src/features/trading/api/market-repository.ts' &&
        // Reviewed request handler; delegates to TanStack, no outbound requests.
        name !== 'src/server.ts'
      ) {
        flag(node, `network API outside reviewed data adapter: ${node.text}`)
      }
      ts.forEachChild(node, walk)
    }
    walk(source)
  }
}

visitDirectory(join(root, 'src'))
if (findings.length) {
  console.error(findings.join('\n'))
  process.exitCode = 1
} else {
  console.log(
    `Checked ${count} source files: no targeted incident indicators or unapproved execution APIs found.`,
  )
}
