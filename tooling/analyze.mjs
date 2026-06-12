// Checks our TextMate grammar against the captured RouterOS universe (tree.json):
// every path must tokenize as support.class, every command as support.function,
// every parameter name as entity.other.attribute-name. Reports the gaps.
//
//   node enumerate.mjs   # first, to capture tree.json from the router
//   node analyze.mjs

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { RecordedRouterOS } from './routeros.mjs'
import { CommandTree, Coverage } from './coverage.mjs'
import { Grammar } from './grammar.mjs'

const here = dirname(fileURLToPath(import.meta.url))

const router = RecordedRouterOS.fromExport(JSON.parse(readFileSync(resolve(here, 'tree.json'), 'utf8')))
const tree = await CommandTree.exploredWith(router)

const grammar = await Grammar.loadedFrom(
  resolve(here, '..', 'syntaxes', 'routeros.tmLanguage.json'),
  resolve(here, 'node_modules/vscode-oniguruma/release/onig.wasm'),
)

Coverage.of(tree, grammar).report().print()
