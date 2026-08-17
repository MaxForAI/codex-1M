# codex-1M

Install, remove, enable, disable, and inspect Codex's 1M-token context support
by typing one short command directly in a Codex conversation.

## In Codex conversation

After the one-time terminal bootstrap below, type any of these commands into a
Codex CLI or GUI conversation. Matching is case-insensitive.

| Conversation command | MCP tool call | Result |
| --- | --- | --- |
| `1m install` | `install_1m` | Install or repair marketplace, plugin, MCP registration, and prompts |
| `1m uninstall` | `uninstall_1m` | Fully remove managed config, prompts, plugin, marketplace, and MCP registration |
| `1m on` | `toggle_1m_context(enable=true)` | Enable the existing opt-in `1m` profile behavior |
| `1m off` | `toggle_1m_context(enable=false)` | Disable the existing opt-in `1m` profile behavior |
| `1m state` | `context_status` | Report the current context configuration |

`1M INSTALL`, `1m UnInstall`, and other casing variants map to the same tools.
Start a new Codex session after installing, uninstalling, or changing context
configuration so the MCP/config state is reloaded.

## First install: terminal bootstrap

`codex-1m` is not currently published in the npm registry. Install the GitHub
repository globally once, then run the installer in a terminal:

```bash
npm i -g github:MaxForAI/codex-1M
codex-1m install
```

This two-step bootstrap is unavoidable: before the MCP server is registered,
a Codex conversation has no `install_1m` tool to call. The second command adds
the `MaxForAI/codex-1M` marketplace, installs `codex-1m@codex-1m`, registers the
bundled MCP server, and writes the managed prompt files. After starting a new
Codex session, `1m install` in conversation can repair that integration.

Do not use `npx 1m`: `1m` is also the name of an unrelated npm package, and
`npx` package resolution is not the codex-1M command. If `command -v 1m`
already points to another executable, resolve that PATH conflict before the
bootstrap.

The package also declares the terminal alias `1m` for bootstrap and recovery,
so `1m install` and `1m uninstall` work in a shell when that alias has no PATH
conflict. The longer `codex-1m` name is the documented recovery command because
it is unambiguous. Terminal commands are a bootstrap/fallback surface; the
normal product surface is the five-command conversation table above.

OpenAI's [Codex MCP documentation](https://developers.openai.com/codex/mcp)
states that the ChatGPT desktop app and Codex CLI share MCP configuration. The
same plugin MCP manifest and case-insensitive tool descriptions therefore serve
both conversation surfaces.

## Uninstall

In a Codex conversation, type `1m uninstall`. The tool invocation finishes
before the running MCP process exits, but it removes its own future registration.

The command creates `config.toml.bak.<timestamp>` before changing a managed
configuration, then:

- restores top-level `model`, `model_context_window`, and
  `model_auto_compact_token_limit` from `codex-1m-state.json` only while all
  three current values still match the values written by codex-1M;
- stops with an explicit conflict, without deleting or restoring anything, if
  a user changed any managed global value after `1m on --global`;
- removes `1m.config.toml`, legacy `[profiles.1m]`, and
  `[mcp_servers.codex-1m]` while preserving unrelated TOML settings;
- removes only recognized codex-1M prompt files;
- removes `codex-1m@codex-1m` and its verified `codex-1m` marketplace entry.

Uninstall is idempotent. Because it fully removes the MCP server and plugin,
`1m install` cannot work in a later conversation: there is no tool left to
receive it. Reinstall from a terminal instead:

```bash
codex-1m install
# or: 1m install
```

The npm global bootstrap remains installed unless it is separately removed.
If the installed Codex build does not expose plugin removal, local configuration
cleanup still finishes and the result prints the remaining manual action.

## What `on` configures

By default, `1m on` creates the Codex V2 profile file at
`$CODEX_HOME/1m.config.toml` (`~/.codex/1m.config.toml` unless `CODEX_HOME` is
set) and registers the MCP server with an absolute Node/script path that works
from terminal and GUI processes without relying on npm's PATH lookup:

```toml
model = "gpt-5.6-sol"
model_context_window = 1000000
model_auto_compact_token_limit = 900000
```

Start Codex with `codex --profile 1m`. The official
[Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
documents profile files as `$CODEX_HOME/profile-name.config.toml` selected by
`--profile profile-name`. If `1m on` finds the obsolete `[profiles.1m]` table,
it first backs up `config.toml`, creates the V2 file, and then removes only that
legacy table.

Use `1m on --global` only when a top-level configuration is explicitly desired.
Before changing the three top-level values it writes
`$CODEX_HOME/codex-1m-state.json`. Each original value is represented as
`{ "existed": true, "value": ... }` or `{ "existed": false }`, and the file
also records the exact managed values. `1m off --global` and `1m uninstall`
restore that snapshot only if all current values still match codex-1M. A later
user edit is a conflict and stops cleanup for manual review.

## State output

`1m state` and the MCP `context_status` tool report configuration, not an
assumption about the already-running conversation:

```text
1M Configured: Yes
Global configuration: disabled
1M profile file: available
Current conversation: unknown (start a new conversation and use /status to verify)
```

`Global configuration` checks the three top-level values. `1M profile file`
checks that `1m.config.toml` exists and has all three expected values. Current
conversation capacity is deliberately `unknown`; start a new conversation and
use `/status` to verify it.

## Safe writes and formatting

All codex-1M writes are serialized by `$CODEX_HOME/.codex-1m.lock`. Data is
written to a unique temporary file in the same directory, the file is `fsync`'d,
atomically renamed over the target, and the directory is `fsync`'d. This avoids
partial files and two codex-1M processes writing at once.

For `config.toml`, codex-1M uses surgical text patches for only its managed
top-level keys and tables. Unrelated comments, whitespace, ordering, tables, and
settings are left byte-for-byte intact. A managed key line or managed table may
be normalized when codex-1M changes it; comments embedded inside a removed
legacy/managed table cannot always retain their original attachment. Files are
parsed before and after relevant changes so malformed or unsupported TOML is
rejected instead of silently restructuring the rest of the configuration.

## Caveats

- **New conversation required:** changing the file does not resize an existing
  conversation. Start a new Codex conversation/session after each toggle.
- **Higher long-context pricing:** input above 272K tokens is subject to a
  higher rate where that pricing applies. Subscription quota conversion is not
  publicly documented.
- **Account access required:** `gpt-5.6-sol` availability depends on the user's
  account and workspace permissions.
- A 1M window is a ceiling, not a guarantee that using more context will improve
  the result; larger prompts can also increase latency and cost.
- codex-1M is a community project, not an OpenAI-supported product.

## Plugin structure

```text
codex-1M/
├── .codex-plugin/plugin.json
├── .agents/plugins/marketplace.json
├── .mcp.json
├── mcp/server.cjs
├── prompts/
├── src/cli.ts
└── package.json
```

`.codex-plugin/plugin.json` points to `.mcp.json`, which starts the
dependency-bundled `mcp/server.cjs` from the installed plugin root. Codex does
not need to run npm lifecycle scripts inside the plugin cache.

## Development and verification

```bash
npm install
npm run build
npm test
```

For a real natural-language routing check, use a disposable `CODEX_HOME` with a
logged-in Codex CLI:

```bash
export CODEX_HOME="$(mktemp -d)"
codex login
codex-1m install
codex
```

In that interactive session, enter these one at a time: `1M install`, `1m
state`, `1M on`, `1m off`, and `1m uninstall`. Confirm the transcript calls
`install_1m`, `context_status`,
`toggle_1m_context` with `enable=true`, `toggle_1m_context` with `enable=false`,
and `uninstall_1m`, respectively. After uninstall, leave the session and run
`codex-1m install` in the terminal to restore the isolated environment.

An isolated environment without a Codex login can still verify MCP `tools/list`
and direct `tools/call`, but it cannot prove the model's natural-language
routing. Never point either check at a real configuration you do not intend to
change.

## License

MIT — see [LICENSE](LICENSE).
