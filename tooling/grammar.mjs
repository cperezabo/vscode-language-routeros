// Our RouterOS TextMate grammar, as used to tokenize lines. Wraps vscode-textmate
// so the rest of the tooling speaks in domain terms (tokenize a line, ask which
// scope families cover a region) instead of registry/oniguruma plumbing.

import { readFileSync } from 'node:fs'
import vsctm from 'vscode-textmate'
import oniguruma from 'vscode-oniguruma'
const { Registry, parseRawGrammar, INITIAL } = vsctm
const { loadWASM, OnigScanner, OnigString } = oniguruma

export class Grammar {
  static async loadedFrom(grammarPath, wasmPath) {
    const wasm = readFileSync(wasmPath)
    await loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength))
    const registry = new Registry({
      onigLib: Promise.resolve({
        createOnigScanner: (patterns) => new OnigScanner(patterns),
        createOnigString: (s) => new OnigString(s),
      }),
      loadGrammar: async (scope) =>
        scope === 'source.routeros'
          ? parseRawGrammar(readFileSync(grammarPath, 'utf8'), grammarPath)
          : null,
    })
    return new Grammar(await registry.loadGrammar('source.routeros'))
  }

  constructor(textmateGrammar) {
    this.textmateGrammar = textmateGrammar
  }

  tokenize(line) {
    const tokens = this.textmateGrammar
      .tokenizeLine(line, INITIAL)
      .tokens.map((token) => ({
        start: token.startIndex,
        end: token.endIndex,
        scope: token.scopes.at(-1),
      }))
    return new TokenizedLine(line, tokens)
  }
}

export class TokenizedLine {
  constructor(line, tokens) {
    this.line = line
    this.tokens = tokens
  }

  // The distinct scope families covering [start, end), ignoring whitespace.
  familiesIn(start, end) {
    return [
      ...new Set(
        this.tokens
          .filter((token) => token.start < end && token.end > start)
          .filter((token) => this.line.slice(Math.max(token.start, start), Math.min(token.end, end)).trim())
          .map((token) => familyOf(token.scope)),
      ),
    ]
  }
}

// Maps a TextMate scope to the coarse family the coverage check reasons about.
const familyOf = (scope) =>
  scope.startsWith('support.class') ? 'path'
  : scope.startsWith('support.function') ? 'command'
  : scope.startsWith('entity.other.attribute-name') ? 'parameter'
  : scope || 'none'
