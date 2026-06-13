// The RouterOS command tree and what it means for our grammar to "cover" it.
// A Menu knows how to probe itself against a Grammar and report its own gaps;
// the CommandTree is the collection of menus; a Gap is one place we tokenize
// something differently than the router's own structure says we should.

export class Menu {
  static async exploring(segments, children, router) {
    const commands = children.flatMap((node) => node.commandNames())
    const probed = ['add', 'set'].filter((name) => commands.includes(name))
    const entries = await Promise.all(
      probed.map(async (name) => [name, await router.parametersOf(segments, name)]),
    )
    return new Menu(segments, commands, Object.fromEntries(entries))
  }

  static fromExport({ segments, commands, params }) {
    return new Menu(segments, commands, params)
  }

  constructor(segments, commands, params) {
    this.segments = segments
    this.commands = commands
    this.params = params
  }

  get path() {
    return '/' + this.segments.join('/')
  }

  coverageGaps(grammar) {
    return this.#commandToProbe().flatMap((command) => {
      const probe = this.#probeFor(command)
      const tokenized = grammar.tokenize(probe.text)
      return probe.spans.flatMap((span) =>
        tokenized
          .familiesIn(span.start, span.end)
          .filter((family) => family !== span.expects)
          .map((family) => new Gap(span.expects, this.path, span.label, family)),
      )
    })
  }

  probedParameters() {
    return this.#commandToProbe().flatMap((command) => command.parameters)
  }

  // Every field of this menu (a name and a command that accepts it), each name once.
  fields() {
    const fields = []
    const alreadySeen = new Set()
    for (const command of Object.keys(this.params)) {
      for (const name of this.params[command]) {
        if (alreadySeen.has(name)) continue
        alreadySeen.add(name)
        fields.push({ command, name })
      }
    }
    return fields
  }

  toExport() {
    return { path: this.path, segments: this.segments, commands: this.commands, params: this.params }
  }

  // The single add/set command we probe (whichever has parameters), or none.
  #commandToProbe() {
    return ['add', 'set']
      .filter((name) => (this.params[name] ?? []).length)
      .slice(0, 1)
      .map((name) => ({ name, parameters: this.params[name] }))
  }

  // A synthetic line "/path command p1=x p2=x ..." plus the spans we expect to
  // tokenize as a path, a command and parameter names.
  #probeFor(command) {
    const path = '/' + this.segments.join(' ')
    const spans = [{ expects: 'path', label: this.path, start: 0, end: path.length }]
    let text = path + ' '
    spans.push({ expects: 'command', label: command.name, start: text.length, end: text.length + command.name.length })
    text += command.name
    command.parameters.forEach((name) => {
      text += ' '
      spans.push({ expects: 'parameter', label: name, start: text.length, end: text.length + name.length })
      text += name + '=x'
    })
    return { text, spans }
  }
}

export class CommandTree {
  static async exploredWith(router, onProgress = () => {}) {
    const menus = []
    const visited = new Set()
    const queue = [[]]
    while (queue.length) {
      const segments = queue.shift()
      if (visited.has(segments.join('/'))) continue
      visited.add(segments.join('/'))
      const children = await router.childrenOf(segments)
      queue.push(...children.flatMap((node) => node.pathsToExploreFrom(segments)))
      if (!segments.length) continue // the root "/" is the entry point, not a configuration menu
      menus.push(await Menu.exploring(segments, children, router))
      onProgress(menus.length)
    }
    return new CommandTree(menus)
  }

  static fromExport(exported) {
    return new CommandTree(exported.map(Menu.fromExport))
  }

  constructor(menus) {
    this.menus = menus
  }

  size() {
    return this.menus.length
  }

  gaps(grammar) {
    return this.menus.flatMap((menu) => menu.coverageGaps(grammar))
  }

  menusProbed() {
    return this.menus.filter((menu) => menu.probedParameters().length).length
  }

  parametersProbed() {
    return this.menus.reduce((total, menu) => total + menu.probedParameters().length, 0)
  }

  toExport() {
    return this.menus.map((menu) => menu.toExport())
  }
}

class Gap {
  constructor(kind, menuPath, label, foundFamily) {
    this.kind = kind
    this.menuPath = menuPath
    this.label = label
    this.foundFamily = foundFamily
  }
}

export class Coverage {
  static of(tree, grammar) {
    return new Coverage(tree, grammar)
  }

  constructor(tree, grammar) {
    this.tree = tree
    this.grammar = grammar
  }

  report() {
    return new CoverageReport(this.tree.gaps(this.grammar), this.tree.menusProbed(), this.tree.parametersProbed())
  }
}

class CoverageReport {
  constructor(gaps, menusProbed, parametersProbed) {
    this.gaps = gaps
    this.menusProbed = menusProbed
    this.parametersProbed = parametersProbed
  }

  print() {
    const ofKind = (kind) => this.gaps.filter((gap) => gap.kind === kind)
    const paths = ofKind('path')
    const commands = ofKind('command')
    const parameters = ofKind('parameter')
    const okPct = ((100 * (this.parametersProbed - parameters.length)) / (this.parametersProbed || 1)).toFixed(2)

    console.log(`\nChecked ${this.menusProbed} menus, ${this.parametersProbed} parameters.\n`)
    console.log(`paths     : ${paths.length} mismatches`)
    console.log(`commands  : ${commands.length} mismatches`)
    console.log(`parameters: ${parameters.length} mismatches  (${okPct}% ok)\n`)

    this.#printParameterGroups(parameters)
    this.#printList('path', paths)
    this.#printList('command', commands)
  }

  #printParameterGroups(parameters) {
    if (!parameters.length) return
    console.log('--- parameter mismatches grouped by scope received ---')
    Object.entries(Object.groupBy(parameters, (gap) => gap.foundFamily))
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([family, group]) => {
        const names = [...new Set(group.map((gap) => gap.label))]
        console.log(`\n[${family}]  ${group.length} occurrences, ${names.length} distinct params:`)
        console.log('  ' + names.slice(0, 25).join(', ') + (names.length > 25 ? ' …' : ''))
      })
  }

  #printList(label, gaps) {
    if (!gaps.length) return
    console.log(`\n--- ${label} mismatches ---`)
    gaps.slice(0, 25).forEach((gap) => console.log(`  ${gap.menuPath} -> ${gap.foundFamily}`))
  }
}
