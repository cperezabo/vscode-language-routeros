// Walks the whole RouterOS command tree via /console/inspect and writes it to
// tree.json (the captured universe analyze.mjs checks the grammar against).
//
//   node enumerate.mjs
//
// Env: ROUTER_URL, ROUTER_USER, ROUTER_PASS.

import { writeFileSync } from 'node:fs'
import { RouterOSOverRest } from './routeros.mjs'
import { CommandTree } from './coverage.mjs'

const router = RouterOSOverRest.at(
  process.env.ROUTER_URL ?? 'http://192.168.88.1',
  process.env.ROUTER_USER ?? 'admin',
  process.env.ROUTER_PASS ?? 'admin',
)

console.error(`Enumerating ${router.baseUrl} ...`)
const tree = await CommandTree.exploredWith(router, (count) => {
  if (count % 25 === 0) console.error(`  ... ${count} menus`)
})

writeFileSync(new URL('tree.json', import.meta.url), JSON.stringify(tree.toExport(), null, 2) + '\n')
console.error(`Done: ${tree.size()} menus -> tree.json`)
