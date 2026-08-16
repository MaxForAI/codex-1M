# codex-1M

Install the Codex plugin from GitHub with one command:

## Install (one command)

```bash
npx --yes github:MaxForAI/codex-1M install
```

## Usage (in a Codex conversation)

Start a **new** Codex conversation after installation, then enter one of these
short commands:

```text
1M on
1M off
1M state
```

Commands are case-insensitive (`1m on`, `1M ON`, and equivalent casing work):

- `1M on` calls `toggle_1m_context` with `enable=true`.
- `1M off` calls `toggle_1m_context` with `enable=false`.
- `1M state` calls `context_status`.

After `1M on` or `1M off`, start one more new conversation for the new context
configuration to take effect.

## What it configures

`toggle_1m_context` writes the following settings either to `[profiles.1m]` or,
when called with `global: true`, to the top level of `~/.codex/config.toml`:

```toml
model = "gpt-5.6-sol"
model_context_window = 1000000
model_auto_compact_token_limit = 900000
```

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
├── .codex-plugin/
│   └── plugin.json                 # required plugin manifest
├── .agents/plugins/
│   └── marketplace.json            # GitHub/local marketplace catalog
├── .mcp.json                        # bundled MCP server definition
├── mcp/
│   └── server.cjs                   # dependency-bundled stdio server
├── src/
│   ├── cli.ts
│   ├── config-manager.ts
│   └── mcp-server.ts
└── package.json
```

`.codex-plugin/plugin.json` is the plugin entry point. Its
`"mcpServers": "./.mcp.json"` field points to the companion MCP configuration.
`.mcp.json` starts `node ./mcp/server.cjs` from the installed plugin root; that
server advertises `toggle_1m_context` and `context_status` over stdio.

The manifest uses the standard fields `name`, `version`, `description`,
`author`, `homepage`, `repository`, `license`, `keywords`, `mcpServers`, and
`interface`. The `interface` block supplies the install UI's display name,
descriptions, developer, category, capabilities, starter prompts, website, and
brand color.

## Exact Codex plugin commands

The current Codex CLI does **not** provide
`codex plugin install <github-url>`, and `codex plugin add` does not accept a
GitHub URL, `github:owner/repo`, or an arbitrary plugin directory. It installs a
plugin from a configured marketplace.

The official two-step form is:

```bash
codex plugin marketplace add MaxForAI/codex-1M
codex plugin add codex-1m@codex-1m
```

`codex plugin marketplace add` accepts GitHub shorthand (`owner/repo` or
`owner/repo@ref`), Git URLs, SSH URLs, and local marketplace-root paths. The
one-command installer at the top is a small wrapper around those two commands;
the `github:` prefix belongs to npm/npx package resolution, not to Codex's
plugin CLI.

Codex discovers this repository's catalog at
`.agents/plugins/marketplace.json`, installs the plugin into its plugin cache,
and records installed/enabled state in Codex configuration. For local
development, the equivalent marketplace registration is:

```bash
codex plugin marketplace add /absolute/path/to/codex-1m
codex plugin add codex-1m@codex-1m
```

Start a new Codex CLI session or desktop conversation after installing so the
bundled MCP tools are loaded.

## Existing CLI

The original CLI remains available for direct, non-plugin use:

```bash
npx github:MaxForAI/codex-1M on             # create/update profile 1m
npx github:MaxForAI/codex-1M off            # remove profile 1m
npx github:MaxForAI/codex-1M state          # show global state
npx github:MaxForAI/codex-1M status         # legacy alias; still supported
npx github:MaxForAI/codex-1M on --global    # enable globally
npx github:MaxForAI/codex-1M off --global   # disable globally
```

The profile mode is opt-in: launch Codex with `codex --profile 1m`. The plugin
defaults to profile mode unless the MCP call explicitly sets `global: true`.

## GUI-friendly alternatives

Codex does not currently document an API for registering a persistent custom
button in its toolbar, Settings, model picker, or reasoning picker. This
repository also includes:

- `prompts/1m-toggle.md`: a compatibility slash prompt;
- `menubar-app/Codex1MToggle/`: a native SwiftUI menu bar switch;
- `raycast/Codex-1M-Toggle.swift`: a Raycast Script Command;
- `scripts/codex-1m-action`: the shared wrapper used by those interfaces.

See [the GUI evidence and implementation guide](docs/gui-integration.md).

## Development and verification

```bash
npm install
npm run build
npm test
```

`npm run build` produces the checked-in, dependency-bundled
`mcp/server.cjs`. This matters because Codex loads bundled plugins without
running npm lifecycle scripts inside the installed plugin directory.

## License

MIT — see [LICENSE](LICENSE).
