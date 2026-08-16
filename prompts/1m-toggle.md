---
description: Run 1M on, 1M off, or 1M state
argument-hint: ACTION=state|status|on|off [GLOBAL=true|false]
---

# 1M Context Toggle

You can enable or disable the 1M token context window in Codex.

Interpret `ACTION` case-insensitively and use `state` when it is omitted. Use
the installed codex-1m MCP tools:

- `ACTION=state` or the legacy `ACTION=status`: call `context_status`.
- `ACTION=on`: call `toggle_1m_context` with `enable=true`.
- `ACTION=off`: call `toggle_1m_context` with `enable=false`.
- Pass `global=true` only when `GLOBAL=true`; otherwise use the safer `1m` profile.

Report the tool result exactly and remind the user that a new Codex chat/session is required. Do not claim the current chat changed context size.

**What This Does:**
When enabled, sets Codex to use `gpt-5.6-sol` with:
- Context window: 1,000,000 tokens
- Auto-compact limit: 900,000 tokens

**Important Notes:**
- Start a new Codex conversation after a configuration change.
- Inputs above 272K tokens may cost more.
- `gpt-5.6-sol` access depends on account and workspace permissions.

**Alternative Methods:**
- Chat: `1M on` / `1M off` / `1M state` (case-insensitive)
- CLI: `npx codex-1m on/off/state` (`status` remains supported)
- Profile: `codex --profile 1m`
- MCP tools: `toggle_1m_context` / `context_status`

See the repository README and `docs/gui-integration.md` for details.
