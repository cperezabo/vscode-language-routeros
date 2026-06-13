# Grammar tooling

Checks (and feeds) the grammar from a **real RouterOS device** instead of
guesswork, via the `/console/inspect` REST API. Two jobs:

- **Coverage** — enumerate the router's entire command tree and verify our
  TextMate grammar tokenizes every path, command and parameter correctly.
- **Code-field detection** — find which fields hold RouterOS code in their value
  (the list the grammar's `embedded-code` rule re-tokenizes), by asking the
  router each field's value type.

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

ROUTER_URL=http://192.168.88.1 \
ROUTER_USER=admin ROUTER_PASS=admin \
npm run detect-code-fields        # lists the code fields (takes a few minutes)
```

`analyze` reports any path/command/parameter that does **not** tokenize as
expected, grouped by the scope it wrongly received — i.e. the coverage gaps.

`detect-code-fields` prints the fields whose value the router types as `Script`
(plus `source`), with the menus where each appears and a ready-to-paste regex
alternation for the grammar's `embedded-code` rule. It talks to the device for
every field, so it is slower than enumeration.

## How it works

- `routeros.mjs` — the RouterOS device as a domain object. `RouterOS` is the
  interface (`childrenOf`, `parametersOf`, `valueTypeOf`); `RouterOSOverRest`
  talks to a real device over `/console/inspect`, and `RecordedRouterOS` replays
  a captured `tree.json`. `MenuNode` / `CommandNode` are a menu's children;
  `ValueType` is what the router reports a field's value should look like.
- `grammar.mjs` — `Grammar` wraps `vscode-textmate` (the engine VS Code itself
  uses, so the check matches the real editor). `tokenize` returns a
  `TokenizedLine` that reports the scope families covering a region.
- `coverage.mjs` — `CommandTree` and `Menu` (each menu probes itself against the
  grammar and reports its own gaps), plus `Coverage` and the report. A path must
  tokenize as `support.class`, a command as `support.function`, a parameter name
  as `entity.other.attribute-name`.
- `code-fields.mjs` — `Field` (does its value hold code?) and `CodeFieldScan`
  (asks the router every field's value type and collects the code-bearing ones).
- `enumerate.mjs` — explores a real router, writes `tree.json` (gitignored;
  version-specific).
- `analyze.mjs` — replays `tree.json` and prints the coverage gaps.
- `detect-code-fields.mjs` — explores a real router and prints its code fields.

## Scope and limits

- Covers the **enumerable structure** (paths, commands, parameter names) of the
  connected RouterOS version — that part can be verified to 100%.
- **Values** (right of `=`) are not coverage-checked: the router marks them
  `none`, so there is no ground truth; our only goal there is to never split a
  value. The exception is **code fields**, whose value type the router does
  report (`Script`) — that is what `detect-code-fields` keys off.
- **Scripting** constructs are a separate finite language, checked by hand.
- Results reflect the version of the connected router; re-run after upgrades.
