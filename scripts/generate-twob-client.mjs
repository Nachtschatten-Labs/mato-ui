import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { rootNodeFromAnchor } from '@codama/nodes-from-anchor'
import { renderVisitor } from '@codama/renderers-js'
import { createFromRoot } from 'codama'

const root = new URL('../', import.meta.url)
const idl = JSON.parse(
  await readFile(new URL('src/lib/idl/twob_anchor.json', root), 'utf8'),
)
const prettierOptions = JSON.parse(
  await readFile(new URL('.prettierrc.json', root), 'utf8'),
)

await createFromRoot(rootNodeFromAnchor(idl)).accept(
  renderVisitor(fileURLToPath(new URL('src/lib/generated/twob', root)), {
    prettierOptions,
    syncPackageJson: false,
    // Renderer 2.4 supports EventNodes but names the Kit 6.10 client-extension
    // type. Map only that module to our Kit 6.5 type adapter.
    dependencyMap: { solanaPluginCore: '../../../kit-compat' },
  }),
)
