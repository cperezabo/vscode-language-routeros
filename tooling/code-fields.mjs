// Which command fields hold RouterOS code in their value — the list the grammar's
// `embedded-code` rule re-tokenizes. Nothing in the syntax marks a string as code,
// so we ask the router for each field's value type: a code field is typed "Script"
// (plus "source", the script body itself). This is the only enumerated list in an
// otherwise structural grammar; re-run after a RouterOS upgrade to refresh it.

export class Field {
  static of(name, valueType) {
    return new Field(name, valueType)
  }

  constructor(name, valueType) {
    this.name = name
    this.valueType = valueType
  }

  // Script handlers are typed "Script". The script body "source" is typed as a
  // plain string (indistinguishable from name/comment by type alone), so it is
  // recognised by name — but only as an actual string, which leaves out the
  // "source" that is an IP address in /routing igmp-proxy mfc.
  holdsCode() {
    return this.valueType.isScript() || (this.name === 'source' && this.valueType.isString())
  }
}

// One code field by name, and the menus where it shows up.
class CodeField {
  static named(name) {
    return new CodeField(name)
  }

  constructor(name) {
    this.name = name
    this.menuPaths = []
  }

  alsoAppearsIn(menuPath) {
    if (!this.menuPaths.includes(menuPath)) this.menuPaths.push(menuPath)
  }

  description() {
    return `${this.name.padEnd(16)} ${this.menuPaths.join('  ')}`
  }
}

export class CodeFieldScan {
  static async of(tree, router, onProgress = () => {}) {
    const scan = new CodeFieldScan()
    let fieldsChecked = 0
    for (const menu of tree.menus) {
      for (const { command, name } of menu.fields()) {
        const valueType = await router.valueTypeOf(menu.segments, command, name)
        if (Field.of(name, valueType).holdsCode()) scan.found(name, menu.path)
        onProgress(++fieldsChecked)
      }
    }
    return scan
  }

  constructor() {
    this.codeFieldsByName = new Map()
  }

  found(name, menuPath) {
    if (!this.codeFieldsByName.has(name)) this.codeFieldsByName.set(name, CodeField.named(name))
    this.codeFieldsByName.get(name).alsoAppearsIn(menuPath)
  }

  names() {
    return this.#sortedByName().map((codeField) => codeField.name)
  }

  print() {
    console.log(`\nCode fields (${this.codeFieldsByName.size}):\n`)
    for (const codeField of this.#sortedByName()) {
      console.log(`  ${codeField.description()}`)
    }
    console.log(`\nembedded-code begin alternation:\n  ${this.names().join('|')}\n`)
  }

  #sortedByName() {
    return [...this.codeFieldsByName.values()].sort((a, b) => a.name.localeCompare(b.name))
  }
}
