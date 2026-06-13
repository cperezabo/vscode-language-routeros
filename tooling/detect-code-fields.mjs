// Asks a live RouterOS device which command fields hold code in their value, so
// the grammar's `embedded-code` rule can be kept in sync after an upgrade. Prints
// the field names (and the menus where each appears) plus a ready-to-paste regex
// alternation.
//
//   node detect-code-fields.mjs
//
// Env: ROUTER_URL, ROUTER_USER, ROUTER_PASS. Talks to the device for every field,
// so it takes a couple of minutes.

import { RouterOSOverRest } from './routeros.mjs'
import { CommandTree } from './coverage.mjs'
import { CodeFieldScan } from './code-fields.mjs'

const router = RouterOSOverRest.at(
  process.env.ROUTER_URL ?? 'http://192.168.88.1',
  process.env.ROUTER_USER ?? 'admin',
  process.env.ROUTER_PASS ?? 'admin',
)

console.error(`Detecting code fields on ${router.baseUrl} ...`)
const tree = await CommandTree.exploredWith(router, (count) => {
  if (count % 25 === 0) console.error(`  ... ${count} menus mapped`)
})
const scan = await CodeFieldScan.of(tree, router, (count) => {
  if (count % 500 === 0) console.error(`  ... ${count} fields checked`)
})
scan.print()
