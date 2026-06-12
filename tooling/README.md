# Coverage tooling

Checks the grammar against a **real RouterOS device** instead of guesswork. It
enumerates the router's entire command tree via the `/console/inspect` REST API
and verifies that our TextMate grammar tokenizes every path, command and
parameter correctly.

Not part of the published extension (excluded via `.vscodeignore`).

## Usage

Point it at a RouterOS v7 device with the REST API enabled
(`/ip service enable www`). A CHR works great.

```sh
npm install                       # once

ROUTER_URL=http://192.168.88.1 \
ROUTER_USER=admin ROUTER_PASS=admin \
npm run enumerate                 # walks the tree -> tree.json

npm run analyze                   # checks the grammar against tree.json
```

`analyze` reports any path/command/parameter that does **not** tokenize as
expected, grouped by the scope it wrongly received — i.e. the coverage gaps.

## How it works

- `routeros.mjs` — the RouterOS device as a domain object. `RouterOS` is the
  interface (`childrenOf`, `parametersOf`); `RouterOSOverRest` talks to a real
  device over `/console/inspect`, and `RecordedRouterOS` replays a captured
  `tree.json`. `MenuNode` / `CommandNode` are a menu's children.
- `grammar.mjs` — `Grammar` wraps `vscode-textmate` (the engine VS Code itself
  uses, so the check matches the real editor). `tokenize` returns a
  `TokenizedLine` that reports the scope families covering a region.
- `coverage.mjs` — `CommandTree` and `Menu` (each menu probes itself against the
  grammar and reports its own gaps), plus `Coverage` and the report. A path must
  tokenize as `support.class`, a command as `support.function`, a parameter name
  as `entity.other.attribute-name`.
- `enumerate.mjs` — explores a real router, writes `tree.json` (gitignored;
  version-specific).
- `analyze.mjs` — replays `tree.json` and prints the coverage gaps.

## Scope and limits

- Covers the **enumerable structure** (paths, commands, parameter names) of the
  connected RouterOS version — that part can be verified to 100%.
- **Values** (right of `=`) are not covered: the router itself marks them `none`,
  so there is no ground truth; our only goal there is to never split a value.
- **Scripting** constructs are a separate finite language, checked by hand.
- Results reflect the version of the connected router; re-run after upgrades.
