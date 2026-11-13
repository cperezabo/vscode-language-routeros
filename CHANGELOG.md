# Changelog

## [2.2.0] - 2026-11-13
- Paths end at command words beyond the generic ones: `/ip dns cache flush`, `/system script run myscript`, `/tool fetch`, `/log info` now split into path, command and value.
- Export unset markers (`!bridge`, `!dns-server`, …) are highlighted as parameters.
- The level word after `:log` (`info`, `warning`, …) is highlighted as a command.

## [2.1.0] - 2026-06-13
- Highlight embedded RouterOS code: the quoted value of script fields (`source`, `on-event`, `*-script`, …) is now tokenized as RouterOS code.
- Fix a path swallowing a following value: `/ping 8.8.8.8`, `/ping example.com` and `/ping fe80::1` now keep the path at `/ping` and the host/IP separate.

## [2.0.0] - 2026-06-12
- Grammar rewritten as a structural TextMate JSON grammar (no enumerated parameter lists); covers RouterOS 7 and keeps up with new versions.
- Fixes highlighting of hyphenated tokens, IPv6, MAC and DHCP client-id, slash paths, rates and composite times.
- Comment character corrected to `#`; added `wordPattern` and folding.
- Added LICENSE and packaging/publish scripts.

## [1.0.0] - 2017-07-04
- Initial release
