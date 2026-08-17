# codex-1M

Use one short command family to install, remove, enable, disable, and inspect
Codex's 1M-token context support.

## Bootstrap the `1m` command once

`codex-1m` is not currently published in the npm registry. Install the GitHub
repository globally once so npm creates the persistent `1m` executable:

```bash
npm install --global github:MaxForAI/codex-1M
```

This bootstrap only puts the command on `PATH`; it does not install the Codex
plugin. Run the regular install command next:

```bash
1m install
```

Do not use `npx 1m`: `1m` is also the name of an unrelated npm package, and
`npx` package resolution is not the codex-1M command. If `command -v 1m`
already points to another executable, resolve that PATH conflict before the
bootstrap.

The package declares both `1m` and the backward-compatible `codex-1m` bin name
for the same `dist/cli.js` entry point. `1m` is the only recommended command.

## Unified command table

Conversation commands are case-insensitive, so `1m on`, `1M ON`, and equivalent
casing work. Shell executable names are case-sensitive; use lowercase `1m` in a
terminal.

| Operation | Terminal shell | Codex CLI conversation | Codex GUI conversation |
| --- | --- | --- | --- |
| Install plugin + marketplace + MCP | `1m install` | — | — |
| Uninstall managed integration | `1m uninstall` | — | — |
| Enable | `1m on` | `1m on` | `1m on` |
| Disable | `1m off` | `1m off` | `1m off` |
| Show state | `1m state` | `1m state` | `1m state` |

`1m install` registers the `MaxForAI/codex-1M` marketplace and installs
`codex-1m@codex-1m`. The plugin manifest loads the bundled MCP server, which
advertises `toggle_1m_context` and `context_status` for the three conversation
commands.

OpenAI's [Codex MCP documentation](https://developers.openai.com/codex/mcp)
states that the ChatGPT desktop app and Codex CLI share MCP configuration. The
same plugin MCP manifest and case-insensitive tool descriptions therefore serve
both conversation surfaces. Start a new CLI session or GUI conversation after
installing or changing state so the server and configuration are reloaded.

## Uninstall

```bash
1m uninstall
```

The command creates `config.toml.bak.<timestamp>` before changing a managed
configuration, then:

- removes the exact managed top-level `model`, `model_context_window`, and
  `model_auto_compact_token_limit` triple only when all values match;
- removes `[profiles.1m]` and `[mcp_servers.codex-1m]` while preserving unrelated
  TOML settings;
- removes only recognized codex-1M prompt files;
- removes `codex-1m@codex-1m` and its verified `codex-1m` marketplace entry.

Uninstall is idempotent. It leaves the global `1m` bootstrap command available,
so the integration can be restored later with `1m install`. If the installed
Codex build does not expose plugin removal, local configuration cleanup still
finishes and the command prints the remaining manual action.

## What `on` configures

By default, `1m on` creates the opt-in `[profiles.1m]` profile and registers the
MCP server with an absolute Node/script path that works from terminal and GUI
processes without relying on npm's PATH lookup:

```toml
[profiles.1m]
model = "gpt-5.6-sol"
model_context_window = 1000000
model_auto_compact_token_limit = 900000
```

Use `1m on --global` only when a top-level configuration is explicitly desired.
Every write creates a timestamped backup and uses a TOML parser so unrelated
configuration, MCP servers, and profiles are preserved.

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

For a manual Codex CLI routing check, use a disposable `CODEX_HOME`, install the
local marketplace with `1m install`, start a new interactive `codex` session,
and enter `1m state`, `1M on`, then `1m off`. Confirm that the transcript shows
calls to `context_status` and `toggle_1m_context`. Never point this check at a
real configuration you do not intend to change.

## License

MIT — see [LICENSE](LICENSE).
