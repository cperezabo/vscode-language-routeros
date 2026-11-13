// Which words end a path as a command — the list the grammar's `command-path`
// rule stops at. A path like '/ip dns cache flush' or '/system script run x' has
// nothing in its syntax that tells the last menu from the command, so we take
// the command names from the captured tree(s). Like the code-field list, this is
// a deliberate exception to the otherwise structural grammar; re-run after a
// RouterOS upgrade to refresh it.
//
// A few names are a command in one menu and a submenu in another ('info' is a
// command in /log but a menu in /interface wireless). Those are resolved by the
// segment before them: whichever side has fewer distinct parents becomes a
// lookbehind, e.g. (?<!\bwireless[\s/])info.

const SEPARATOR = '[\\s/]'

// One command name, and the menus that put it right after a given segment.
class CommandWord {
  static named(name) {
    return new CommandWord(name)
  }

  constructor(name) {
    this.name = name
    this.commandParents = new Set()
    this.menuParents = new Set()
  }

  isCommandAfter(segment) {
    this.commandParents.add(segment)
  }

  isMenuAfter(segment) {
    this.menuParents.add(segment)
  }

  isAmbiguous() {
    return this.menuParents.size > 0
  }

  // Same parent on both sides: the segment before cannot tell them apart, so the
  // word is left out and the path keeps it, as before.
  isUnresolvable() {
    return [...this.menuParents].some((segment) => this.commandParents.has(segment))
  }

  pattern() {
    if (!this.isAmbiguous()) return this.name

    const preferMenus = this.menuParents.size < this.commandParents.size
    const parents = [...(preferMenus ? this.menuParents : this.commandParents)].sort()
    const alternatives = parents.map((segment) => `\\b${segment}${SEPARATOR}`).join('|')

    return preferMenus ? `(?<!${alternatives})${this.name}` : `(?<=${alternatives})${this.name}`
  }

  description() {
    const commands = [...this.commandParents].sort().join(' ')
    const menus = [...this.menuParents].sort().join(' ')
    return `${this.name.padEnd(12)} command after: ${commands}   menu after: ${menus}`
  }
}

export class CommandWords {
  // Takes one or more command trees (e.g. one per RouterOS version) and merges
  // them, so the list covers every version they came from.
  static of(trees) {
    const words = new CommandWords()

    for (const tree of trees) {
      for (const menu of tree.menus) words.#collect(menu)
    }

    words.#markMenuClashes()

    return words
  }

  constructor() {
    this.byName = new Map()
    this.menuParentsByName = new Map()
  }

  print() {
    const words = this.#words()
    const ambiguous = words.filter((word) => word.isAmbiguous() && !word.isUnresolvable())
    const unresolvable = words.filter((word) => word.isUnresolvable())

    console.log(`\nCommand words (${words.length - unresolvable.length}), resolved by the segment before them:\n`)
    for (const word of ambiguous) console.log(`  ${word.description()}`)

    if (unresolvable.length) {
      console.log('\nLeft out, same parent on both sides:\n')
      for (const word of unresolvable) console.log(`  ${word.description()}`)
    }

    console.log(`\ncommand-path command alternation:\n  ${this.alternation()}\n`)
  }

  alternation() {
    return this.#words()
      .filter((word) => !word.isUnresolvable())
      .map((word) => word.pattern())
      .join('|')
  }

  #collect(menu) {
    if (!menu.segments.length) return // the root '/' has no segment before its commands

    for (const command of menu.commands) {
      this.#word(command).isCommandAfter(menu.segments.at(-1))
    }

    // A top-level menu is the path's first segment, which never stops at a
    // command word, so only nested menus can clash with a command name.
    if (menu.segments.length > 1) {
      const name = menu.segments.at(-1)
      if (!this.menuParentsByName.has(name)) this.menuParentsByName.set(name, new Set())
      this.menuParentsByName.get(name).add(menu.segments.at(-2))
    }
  }

  #word(name) {
    if (!this.byName.has(name)) this.byName.set(name, CommandWord.named(name))
    return this.byName.get(name)
  }

  #markMenuClashes() {
    for (const word of this.byName.values()) {
      for (const segment of this.menuParentsByName.get(word.name) ?? []) word.isMenuAfter(segment)
    }
  }

  #words() {
    return [...this.byName.values()].sort((a, b) => a.name.localeCompare(b.name))
  }
}
