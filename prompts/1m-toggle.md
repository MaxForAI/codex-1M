---
description: Route the five codex-1M conversation commands
---

# 1M Context Toggle

Recognize these commands after trimming whitespace. Matching is
case-insensitive, so `1m install`, `1M INSTALL`, and equivalent casing are valid:

- `1M install`: call `install_1m`.
- `1M uninstall`: call `uninstall_1m`.
- `1M on`: call `toggle_1m_context` with `enable=true`.
- `1M off`: call `toggle_1m_context` with `enable=false`.
- `1M state`: call `context_status`.

Do not pass `global=true` unless the user explicitly requests a global change;
otherwise use the safer `1m` profile.

Report the tool result exactly and remind the user that a new Codex chat/session is required. Do not claim the current chat changed context size.

**What This Does:**
When enabled, sets Codex to use `gpt-5.6-sol` with:
- Context window: 1,000,000 tokens
- Auto-compact limit: 900,000 tokens

**Important Notes:**
- Start a new Codex conversation after a configuration change.
- Inputs above 272K tokens may cost more.
- `gpt-5.6-sol` access depends on account and workspace permissions.

**Unified commands:**
- Codex CLI or GUI conversation: `1m install` / `1m uninstall` / `1m on` / `1m off` / `1m state`
- Terminal bootstrap/fallback: `codex-1m install` / `codex-1m uninstall`

Conversation matching is case-insensitive. The underlying MCP tools are
`install_1m`, `uninstall_1m`, `toggle_1m_context`, and `context_status`.

The first installation must run in a terminal because no MCP server exists to
receive `1M install` yet. `1M uninstall` removes the MCP registration, so use
`codex-1m install` in a terminal to reinstall afterward.

See the repository README and `docs/gui-integration.md` for details.
