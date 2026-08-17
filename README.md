# codex-1M

Unlock Codex's long-context mode with one command.

[![CI](https://github.com/MaxForAI/codex-1M/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/MaxForAI/codex-1M/actions/workflows/ci.yml)
[![Version](https://img.shields.io/github/package-json/v/MaxForAI/codex-1M)](https://github.com/MaxForAI/codex-1M/releases)
[![License](https://img.shields.io/github/license/MaxForAI/codex-1M)](LICENSE)

codex-1M configures new `gpt-5.6-sol` conversations to request a 1,000,000-token
context window, with five simple commands to install, enable, inspect, disable,
or remove the integration.

Actual usable window is capped by Codex — see
[Why the usable window is ~828K](#why-the-usable-window-is-828k).

## Install

```bash
npx --yes github:MaxForAI/codex-1M install
```

Installation saves the current complete Codex configuration once at
`$CODEX_HOME/codex-1m-pristine.toml` (normally
`~/.codex/codex-1m-pristine.toml`). The file is owner-read-only and is never
overwritten. Repeat the same `install` command to refresh the marketplace and
upgrade the plugin to the latest version.

Start a new Codex conversation after installation.

## In Codex conversation

Commands and matching are case-insensitive. The complete command set is five
commands:

| Conversation command | MCP tool call | Result |
| --- | --- | --- |
| `1m install` | `install_1m` | Install, repair, or upgrade the marketplace and plugin; preserve the first pristine config |
| `1m uninstall` | `uninstall_1m` | Precisely restore managed keys and remove the plugin/marketplace |
| `1m on` | `toggle_1m_context(enable=true)` | Modify global Codex configuration by default |
| `1m off` | `toggle_1m_context(enable=false)` | Restore the global snapshot by default |
| `1m state` | `context_status` | Report configuration plus requested and expected usable limits |

After a toggle, create a new conversation. Codex Desktop does not select a CLI
profile, which is why global mode is the default.

## Fallback: global terminal bootstrap

```bash
npm i -g github:MaxForAI/codex-1M
codex-1m install
```

Before the plugin is installed, a conversation has no `install_1m` tool to
call. A full uninstall likewise removes that tool, so reinstall from a terminal.
Do not use `npx 1m`; that name belongs to an unrelated npm package.

The package exposes both `codex-1m` and `1m` terminal executables when there is
no PATH conflict. Their five subcommands are also matched case-insensitively.

## Global default and explicit profile mode

`1m on` writes these top-level keys to `$CODEX_HOME/config.toml`:

```toml
model = "gpt-5.6-sol"
model_context_window = 1000000
model_auto_compact_token_limit = 900000
```

Before the first global write, it creates:

- `config.toml.bak.<timestamp>`: a byte-for-byte transaction backup;
- `codex-1m-state.json`: a key-level snapshot of the three original values and
  the exact values managed by codex-1M.

`1m off` restores an original value only if every current managed value still
matches what codex-1M wrote. If the user changed any managed value, it stops
with an explicit conflict and leaves both config and snapshot untouched. The
backward-compatible `1m on --global` and `1m off --global` forms do the same
thing as the new defaults.

Profile mode is now explicit:

```bash
1m on --profile
codex --profile 1m
1m off --profile
```

It operates only on `$CODEX_HOME/1m.config.toml` and does not change top-level
global values. The MCP equivalent passes `profile: true` to
`toggle_1m_context`.

## State output

Example after default global enablement:

```text
1M Configured: Yes
Global configuration: enabled
1M profile file: missing
Requested context window: 1,000,000 tokens (configured request)
Expected usable window: ~828,400 tokens (server limit 872,000 × 95%)
Auto-compact: configured 900,000 → expected effective ~784,800 tokens
Current conversation: unknown (start a new conversation and use /status to verify)
```

`Global configuration` and `1M profile file` remain independent status fields. `Current conversation`
remains unknown because a configuration file cannot prove the runtime budget of
an already-created task.

## Pristine escape hatch and uninstall safety

The first `install` creates `$CODEX_HOME/codex-1m-pristine.toml` only if it does
not already exist. Later installs preserve it, and uninstall neither restores
nor deletes it.

This is deliberate: after installation, a user may add an MCP server, change a
model, or adjust sandbox settings. Automatically replacing the whole config
with the pristine copy would roll back those legitimate later changes and cause
data loss. Normal uninstall therefore uses `codex-1m-state.json` conflict
detection and restores only the three keys this project changed. Its output
prints the pristine path so a user who truly wants the complete pre-install
configuration can inspect and copy it manually.

Uninstall also removes a managed `1m.config.toml`, obsolete
`[profiles.1m]`/`[mcp_servers.codex-1m]` tables, recognized legacy prompt copies,
the plugin, and its verified marketplace. Unrelated TOML formatting and settings
are preserved.

## Safe writes

Writes are serialized by `$CODEX_HOME/.codex-1m.lock`, written to a unique
same-directory temporary file, `fsync`'d, and atomically renamed. Surgical TOML
patches preserve unrelated comments, whitespace, ordering, tables, and values.
Malformed TOML and user-modified managed values are rejected rather than
silently rewritten.

## Why the usable window is ~828K

The distinction below is central to this project, not a footnote.

| Stage | Value | Status |
| --- | ---: | --- |
| Plugin writes `model_context_window` | 1,000,000 | **Verified fact:** this is a configuration request |
| Codex online model metadata cap | 872,000 | **Verified fact:** Codex clamps the request to `max_context_window` |
| Usable-input allocation | 872,000 × 95% = **828,400** | **Verified fact:** observed in a new `gpt-5.6-sol` task |
| Auto-compact threshold | 872,000 × 90% = **784,800** | **Verified fact:** the configured 900,000/1,000,000 ratio is applied after the cap |
| Advertised model API total window | 1.05M | A different concept from the Codex product's usable input budget |

**Reasonable inference, not an official explanation:** 872,000 equals
1,000,000 − 128,000, and official model documentation lists a 128K maximum
output. This is consistent with Codex reserving output capacity first, but
OpenAI has not directly documented why the Codex product-level cap is exactly
872,000. The verified 872,000 cap, 95% allocation, 828,400 observed usable
window, and ~784,800 effective compaction threshold do not depend on that
inference.

Changing configuration does not resize an existing conversation. Always start
a new task and use `/status` to verify the value actually allocated to it.

## Caveats

- New conversations are required after install, uninstall, on, or off.
- Input above 272K tokens may use higher long-context pricing where applicable.
- `gpt-5.6-sol` access depends on the user's account and workspace.
- More context can increase latency and cost and does not guarantee a better result.
- codex-1M is a community project, not an OpenAI-supported product.

## Development and verification

```bash
npm install
npm run build
npm test
npm run test:e2e:real
```

The Jest suite covers command routing, install-as-upgrade, pristine creation and
non-overwrite, default-global/profile behavior, state disclosure, precise
rollback, and conflict refusal. The real E2E uses a temporary `CODEX_HOME` and
the installed Codex CLI; it never points lifecycle commands at the user's real
configuration.

The plugin manifest loads `skills/codex-1m/SKILL.md` and the bundled
`mcp/server.cjs`. `package.json` is the version source of truth; the build syncs
the plugin manifest before compilation.

## License

MIT — see [LICENSE](LICENSE).
