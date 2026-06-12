// A RouterOS device we can ask about its command tree, via /console/inspect.
// Abstract interface with two implementations: one that talks to a real device
// over REST, and one that replays a previously captured tree.

export class RouterOS {
  childrenOf(_segments) {
    throw new Error('subclass responsibility')
  }

  parametersOf(_segments, _command) {
    throw new Error('subclass responsibility')
  }
}

// A child of a menu: either a navigable submenu or a runnable command. Each one
// knows what it contributes to an exploration, so no type checks are needed.
export class MenuNode {
  static named(name) {
    return new MenuNode(name)
  }

  constructor(name) {
    this.name = name
  }

  pathsToExploreFrom(segments) {
    return [[...segments, this.name]]
  }

  commandNames() {
    return []
  }
}

export class CommandNode {
  static named(name) {
    return new CommandNode(name)
  }

  constructor(name) {
    this.name = name
  }

  pathsToExploreFrom(_segments) {
    return []
  }

  commandNames() {
    return [this.name]
  }
}

const NAVIGABLE_NODE_TYPES = new Set(['path', 'dir'])

// Translates one raw /console/inspect child item into a domain node.
const nodeFrom = (item) =>
  NAVIGABLE_NODE_TYPES.has(item['node-type'])
    ? MenuNode.named(item.name)
    : CommandNode.named(item.name)

export class RouterOSOverRest extends RouterOS {
  static at(baseUrl, username, password) {
    const authorization = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
    return new RouterOSOverRest(baseUrl, authorization)
  }

  constructor(baseUrl, authorization) {
    super()
    this.baseUrl = baseUrl
    this.authorization = authorization
  }

  async childrenOf(segments) {
    const items = await this.#inspect({ request: 'child', input: '', path: segments.join(',') })
    return items.filter((item) => item.type !== 'self').map(nodeFrom)
  }

  async parametersOf(segments, command) {
    const input = '/' + segments.map((s) => s + ' ').join('') + command + ' '
    const symbols = await this.#inspect({ request: 'syntax', input })
    return symbols
      .filter((s) => s.symbol && s['symbol-type'] === 'explanation' && !s.symbol.startsWith('<'))
      .map((s) => s.symbol)
  }

  async #inspect(body) {
    const response = await fetch(`${this.baseUrl}/rest/console/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: this.authorization },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${JSON.stringify(body)}`)
    return response.json()
  }
}

// Replays a captured tree (the export written by enumerate.mjs), so coverage can
// be re-run without a live device.
export class RecordedRouterOS extends RouterOS {
  static fromExport(menus) {
    return new RecordedRouterOS(menus)
  }

  constructor(menus) {
    super()
    this.menus = menus
  }

  childrenOf(segments) {
    const submenus = this.menus
      .filter((m) => m.segments.length === segments.length + 1 && startsWith(m.segments, segments))
      .map((m) => MenuNode.named(m.segments.at(-1)))
    const commands = this.#menuAt(segments).commands.map(CommandNode.named)
    return [...submenus, ...commands]
  }

  parametersOf(segments, command) {
    return this.#menuAt(segments).params[command] ?? []
  }

  #menuAt(segments) {
    return this.menus.find((m) => sameSegments(m.segments, segments)) ?? { commands: [], params: {} }
  }
}

const sameSegments = (a, b) => a.length === b.length && a.every((s, i) => s === b[i])
const startsWith = (segments, prefix) => sameSegments(segments.slice(0, prefix.length), prefix)
