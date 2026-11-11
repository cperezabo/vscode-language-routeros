// Lists the words that end a path as a command, so the grammar's `command-path`
// rule can be kept in sync after an upgrade. Reads one or more captured trees
// (default: tree.json), merges them, and prints the names that are also a menu
// somewhere plus a ready-to-paste regex alternation.
//
//   node enumerate.mjs                                  # first, to capture tree.json
//   node detect-command-words.mjs                       # tree.json
//   node detect-command-words.mjs v6.json v7.12.json    # several versions merged

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { CommandTree } from './coverage.mjs'
import { CommandWords } from './command-words.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const files = process.argv.slice(2)

const trees = (files.length ? files : [resolve(here, 'tree.json')])
  .map((file) => CommandTree.fromExport(JSON.parse(readFileSync(file, 'utf8'))))

CommandWords.of(trees).print()
