# codex-1M

[![CI](https://github.com/MaxForAI/codex-1M/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/MaxForAI/codex-1M/actions/workflows/ci.yml)
[![Version](https://img.shields.io/github/package-json/v/MaxForAI/codex-1M)](https://github.com/MaxForAI/codex-1M/releases)
[![License](https://img.shields.io/github/license/MaxForAI/codex-1M)](LICENSE)

Install, update, diagnose, configure, remove, and inspect Codex's 1M-token
settings by typing one short command directly in a Codex conversation.

## Install

One command installs the GitHub package and runs its installer:

```bash
npx --yes github:MaxForAI/codex-1M install
```

Start a new Codex conversation after it completes.

## In Codex conversation

After the one-time terminal bootstrap below, type any of these commands into a
Codex CLI or GUI conversation. Matching is case-insensitive.

| Conversation command | MCP tool call | Result |
| --- | --- | --- |
| `1m install` | `install_1m` | Install or repair the marketplace and plugin-provided MCP/Skill integration |
| `1m update` | `update_1m` | Refresh the marketplace and reinstall the latest plugin version |
| `1m doctor` | `doctor_1m` | Diagnose CLI, repository, plugin, config, MCP, profile, and state files |
| `1m uninstall` | `uninstall_1m` | Remove managed config, legacy copies, plugin, and marketplace |
| `1m on` | `toggle_1m_context(enable=true)` | Create or update the opt-in `1m` profile configuration |
| `1m off` | `toggle_1m_context(enable=false)` | Remove the managed opt-in `1m` profile configuration |
| `1m state` | `context_status` | Report the current context configuration |

`1M INSTALL`, `1m Doctor`, and other casing variants map to the same tools.
Start a new Codex session after installing, uninstalling, or changing context
configuration so the MCP/config state is reloaded.

## Fallback: global terminal bootstrap

If the one-command `npx` bootstrap is unavailable, install the GitHub repository
globally and then run the installer:

```bash
npm i -g github:MaxForAI/codex-1M
codex-1m install
```

Before the plugin is installed, a Codex conversation has no `install_1m` tool to
call. The installer adds the `MaxForAI/codex-1M` marketplace and installs
`codex-1m@codex-1m`. The plugin manifest then provides its bundled MCP server and
formal command-routing Skill without writing a duplicate global MCP entry or
copying prompt files. After starting a new Codex session, `1m install` in a
conversation can repair that integration.

Do not use `npx 1m`: `1m` is also the name of an unrelated npm package, and
`npx` package resolution is not the codex-1M command. If `command -v 1m`
already points to another executable, resolve that PATH conflict before the
bootstrap.

The package also declares the terminal alias `1m` for bootstrap and recovery,
so `1m install` and `1m uninstall` work in a shell when that alias has no PATH
conflict. The longer `codex-1m` name is the documented recovery command because
it is unambiguous. Terminal commands are a bootstrap/fallback surface; the
normal product surface is the seven-command conversation table above.

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
  a legacy `[mcp_servers.codex-1m]` left by versions before 1.7.0 while
  preserving unrelated TOML settings;
- removes only recognized legacy codex-1M prompt copies;
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
set). MCP availability comes from the installed plugin manifest and is not
written into the global config by this command:

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

## Demo GIF (planned)

The README reserves this location for `docs/codex-1m-demo.gif`. The recommended
recording should start in a disposable Codex conversation, enter `1m on`, show
the tool reporting **1M Configured**, start a new conversation with
`codex --profile 1m`, and use `/status` to verify the actual context attached to
that conversation. It should not display a real home path, account data,
credentials, or the contents of a user's configuration.

<!-- Replace this comment after recording: ![Configure and verify Codex 1M](docs/codex-1m-demo.gif) -->

## Update and doctor

`1m update` uses the verified Codex CLI sequence:

```bash
codex plugin marketplace upgrade codex-1m --json
codex plugin remove codex-1m@codex-1m --json
codex plugin add codex-1m@codex-1m --json
```

If the marketplace or plugin is missing, it is added instead. `1m doctor` is
read-only and reports the Codex CLI version, configured marketplace snapshot
version, installed plugin version, configuration mode (`global`, `profile file`,
or `not configured`), bundled MCP server path/existence/executability, and the
presence of `1m.config.toml` and `codex-1m-state.json`.

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
├── skills/codex-1m/SKILL.md
├── src/cli.ts
└── package.json
```

`.codex-plugin/plugin.json` points to `.mcp.json`, which starts the
dependency-bundled `mcp/server.cjs` from the installed plugin root. Codex does
not need to run npm lifecycle scripts inside the plugin cache. The manifest's
`"skills": "./skills/"` field loads the formal Skill. `package.json` is the
version source of truth: the CLI and MCP server import it, and the build runs
`scripts/sync-plugin-version.cjs` to update the plugin manifest before compiling.

## Roadmap

Publish the package as `@maxforai/codex-1m`, with matching Git tags, GitHub
Releases, and npm provenance for each release.

## Development and verification

```bash
npm install
npm run build
npm test
```

The regular GitHub Actions matrix does not assume that Codex CLI or a logged-in
account exists. Real lifecycle coverage is therefore an explicit local test:

```bash
npm run test:e2e:real
```

It requires `codex-cli >= 0.134.0`, uses a newly created temporary `CODEX_HOME`,
and exercises `install`, `update`, `doctor`, `on`, `off`, `state`, and
`uninstall` against a real Codex plugin implementation. It also verifies TOML
comment/format preservation, owner-only permissions for managed profile/state
files, preservation of the existing config mode, and lock behavior under two
concurrent global writes. The default marketplace source is the GitHub
repository because Codex does not support `marketplace upgrade` for a local-path
marketplace. Override it with `CODEX_1M_E2E_SOURCE` only when the alternative is
a real Git marketplace. Set `CODEX_E2E_REQUIRED=1` to treat a missing Codex CLI
as a failure, or `CODEX_1M_E2E_KEEP=1` to retain the disposable files for review.

For a real natural-language routing check, use a disposable `CODEX_HOME` with a
logged-in Codex CLI:

```bash
export CODEX_HOME="$(mktemp -d)"
codex login
codex-1m install
codex
```

In that interactive session, enter these one at a time: `1M install`, `1m
update`, `1m doctor`, `1m state`, `1M on`, `1m off`, and `1m uninstall`.
Confirm the transcript calls `install_1m`, `update_1m`, `doctor_1m`, `context_status`,
`toggle_1m_context` with `enable=true`, `toggle_1m_context` with `enable=false`,
and `uninstall_1m`, respectively. After uninstall, leave the session and run
`codex-1m install` in the terminal to restore the isolated environment.

An isolated environment without a Codex login can still verify MCP `tools/list`
and direct `tools/call`, but it cannot prove the model's natural-language
routing. Never point either check at a real configuration you do not intend to
change.

## License

MIT — see [LICENSE](LICENSE).
