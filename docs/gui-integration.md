# Codex desktop GUI integration for 1M context

Investigation date: 2026-08-17. The tested desktop build was ChatGPT/Codex
`26.810.52044` (`com.openai.codex`) with its bundled `codex-cli
0.148.0-alpha.9` on macOS.

## Direct answer

There is currently **no documented API that lets codex-1m register a persistent
button in the Codex app toolbar, Settings, model picker, or reasoning picker**.
Do not patch `ChatGPT.app` or its `app.asar`: that would modify a signed,
auto-updated application bundle and is not a supported extension mechanism.

The app does have supported extension surfaces, but they are narrower:

- A prompt or enabled skill can appear in the desktop slash-command list.
- The desktop app reads the same local MCP configuration as Codex CLI and can
  show server state through `/mcp`; MCP tools are available to the agent.
- Installed plugins are visible in the Plugins surface and may add skills,
  connectors, and MCP tools to **new chats**.
- An MCP server can return MCP Apps UI. That UI is an iframe rendered alongside
  a conversation/tool result, not a persistent button in the app chrome.

So the honest product answer is: **no native 1M toolbar/settings switch today;
yes to a chat command or chat-embedded component; yes to a separate macOS menu
bar switch.**

## Evidence matrix

| Question | Evidence-backed result |
| --- | --- |
| Custom toolbar button or Settings panel | **No documented registration point found.** The official Settings page lists app preferences, keyboard shortcuts, appearance, pets, Browser, and Computer Use, but no third-party settings-panel API. Plugin and MCP docs do not define app-chrome contributions. |
| Custom slash command | **Yes.** The desktop slash-command reference says enabled skills and `/prompts:<name>` commands appear in the slash list. The older Custom Prompts page labels prompts deprecated in favor of skills, so a skill is the longer-lived path. |
| Command palette / dev mode | The composer slash list and configurable keyboard-shortcut screen are documented. **No evidence found** that either accepts arbitrary third-party commands or UI contributions. No supported developer mode for patching app UI was found. |
| Custom tool panel | Plugins and `/mcp` provide management/status surfaces, but **no generic persistent custom tool-panel API was found**. MCP Apps UI is conversation-scoped. |
| `~/.codex/config.toml` MCP servers | **Yes.** Official MCP docs say the desktop app, CLI, and IDE extension share MCP configuration for the same Codex host. The local bundled CLI listed the configured servers without changing the file. |
| `~/.codex/prompts/*.md` | **Visible as slash commands according to the current desktop slash-command reference.** The dedicated Custom Prompts page is deprecated and mentions only CLI/IDE, which is a documentation inconsistency. Prefer a skill for future work; test prompts on the installed desktop build before depending on them. |
| Other config reflected in GUI | The config reference documents user config, desktop settings, plugins, model keys, and `model_catalog_json`. It does **not** promise that every key becomes a GUI control. Configuration affecting the agent is not the same as extending UI. |
| MCP tools as clickable controls | Tools are available to the agent and server status is visible via `/mcp`. **No evidence found** that arbitrary local tools automatically become permanent buttons. A tool may explicitly return an MCP Apps component inside the conversation. |
| Community/official mechanism for in-GUI UI | **Official, limited mechanism exists:** plugin/MCP Apps UI. Components run in an iframe alongside the conversation. This is not a toolbar, Settings, or picker extension. No separate supported community patch mechanism was found. |
| Model picker / reasoning picker customization | `/model` and `/reasoning` are official desktop commands. `model_catalog_json` is a startup config key for supplying a model catalog, but the reference does not document it as a public GUI contribution API. **No evidence found** for adding an arbitrary toggle, annotation, or reasoning level to these pickers. |

## Local implementation observations

These observations are first-hand checks of the installed build, not claims
about undocumented internal contracts:

1. `Info.plist` reports bundle id `com.openai.codex`, version
   `26.810.52044`, and Electron ASAR integrity metadata.
2. Running processes include Electron renderer/service processes and the
   bundled `codex app-server`; the installed GUI demonstrably launches the
   Codex engine. This observation alone is not used to infer undocumented UI
   extension contracts.
3. `/Applications/ChatGPT.app/Contents/Resources/codex mcp list` read the same
   configured MCP server names as the local configuration. No values or
   credentials were copied into this repository.
4. The packaged ASAR contains plugin/MCP setup UI. This confirms built-in
   management UI, but inspection found no supported manifest hook for a custom
   app-chrome button. Absence in a minified bundle is not proof by itself, so
   the conclusion relies on the documented extension contracts above.

## Recommended implementation paths

### 1. Plugin Skill plus MCP tool — lowest friction

Files: `skills/codex-1m/SKILL.md`, `.mcp.json`, and `src/mcp-server.ts`, all
loaded through `.codex-plugin/plugin.json` after `1m install`.

After the terminal bootstrap, restart the desktop app, then type `1m install`,
`1m update`, `1m doctor`, `1m uninstall`, `1m state`, `1m on`, or `1m off` in
the conversation. Matching is case-insensitive. The Skill routes these commands
to the MCP tools, whose descriptions are maintained once in `src/mcp-tools.ts`.
The installer no longer copies custom prompt files or writes a duplicate global
MCP registration. First install still requires a terminal because the plugin's
MCP server does not exist yet. A full uninstall removes that server, so reinstall
afterward with `codex-1m install` in a terminal.

User experience: visible/searchable in the composer slash list, but not always
on screen. The tool result appears in chat. Changing the file does not resize
the already-created session; start a new local chat/session. A profile-only
enable also requires launching a client/session that selects profile `1m`.

### 2. Native macOS menu bar app — closest real button

Files: `menubar-app/Codex1MToggle/Codex1MToggleApp.swift` and
`scripts/codex-1m-action`.

The SwiftUI `MenuBarExtra` shows `1M ✓`, `1M –`, or an error state and exposes
Enable, Disable, and Refresh. It does **not** parse or rewrite TOML itself. It
delegates to the project's tested CLI, which creates backups and uses a TOML
parser. This avoids the risk of regex changes accidentally touching a profile
or similarly named key.

User experience: persistent one-click control outside the Codex window. The
included source is locally buildable; public distribution still needs an Apple
Developer signing identity and notarization. The switch changes global config,
and only new Codex chats/sessions pick it up.

### 3. Raycast command / global shortcut

Files: `raycast/Codex-1M-Toggle.swift` and `scripts/codex-1m-action`.

Add the `raycast` folder as a Script Commands directory, then bind “Toggle Codex
1M Context” to a global hotkey. The script reads status through the project CLI
and calls global `on` or `off`. It performs no direct TOML manipulation.

User experience: one keystroke and a compact Raycast result. Raycast itself is
free for Script Commands; no paid feature is required for this local script.
The new setting applies only to new Codex chats/sessions.

### 4. macOS Shortcuts

Create “Run Shell Script” actions that call the repository helper:

```sh
/Users/you/dev/codex-1m/scripts/codex-1m-action status
/Users/you/dev/codex-1m/scripts/codex-1m-action on
/Users/you/dev/codex-1m/scripts/codex-1m-action off
```

Assign a keyboard shortcut in the Shortcuts app. This has the same global/new
session semantics as the menu bar app and Raycast.

### 5. Conversation-embedded MCP Apps switch — supported but higher cost

This is the only supported route to a literal custom control rendered *inside*
the conversation. It would require:

1. adding an MCP `ui://` resource to `src/mcp-server.ts`;
2. attaching `_meta.ui.resourceUri` to a render/status tool;
3. returning structured status content;
4. building an HTML/React component whose buttons call
   `toggle_1m_context` through the MCP Apps bridge;
5. packaging/testing it as a plugin in a local marketplace and opening a new
   chat after installation.

This remains a TODO because it is not a persistent app switch, local-host UI
support must be tested on the target desktop build, and a distributable plugin
requires packaging/review work. It does not justify patching the desktop app.

## Source record

Official sources accessed 2026-08-17:

- [Desktop slash commands](https://learn.chatgpt.com/docs/reference/slash-commands)
- [Model Context Protocol in Codex](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [Plugins in ChatGPT and Codex](https://learn.chatgpt.com/docs/plugins)
- [Add UI to an MCP server](https://developers.openai.com/plugins/build/chatgpt-ui)
- [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [Desktop settings](https://learn.chatgpt.com/docs/reference/settings)
- [Custom prompts (deprecated)](https://learn.chatgpt.com/docs/custom-prompts)

No third-party article is used as proof of product capability. Where the
official material did not establish a behavior, this document says “no evidence
found” rather than inferring support.

## Safety and lifecycle notes

- None of the repository checks for this investigation wrote the active
  `~/.codex/config.toml`.
- Toggle actions intentionally write that file only when the user clicks or
  invokes `on`/`off`; the project CLI creates a backup first.
- Do not place API keys, bearer tokens, or copied config contents in docs,
  scripts, screenshots, or issue reports.
- After any toggle, create a new chat/session and use `/status` to verify the
  context limit actually attached to that session. A successful file write is
  not proof that an existing conversation changed.
