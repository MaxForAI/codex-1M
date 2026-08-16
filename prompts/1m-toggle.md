---
description: Show status or enable/disable the Codex 1M context profile
argument-hint: ACTION=status|on|off [GLOBAL=true|false]
---

# 1M Context Toggle

You can enable or disable the 1M token context window in Codex.

Interpret `ACTION` as `status` when it is omitted. Use the installed codex-1m MCP tools:

- `ACTION=status`: call `context_status`.
- `ACTION=on`: call `toggle_1m_context` with `enable=true`.
- `ACTION=off`: call `toggle_1m_context` with `enable=false`.
- Pass `global=true` only when `GLOBAL=true`; otherwise use the safer `1m` profile.

Report the tool result exactly and remind the user that a new Codex chat/session is required. Do not claim the current chat changed context size.

**What This Does:**
When enabled, sets Codex to use `gpt-5.6-sol` with:
- Context window: 1,000,000 tokens
- Auto-compact limit: 900,000 tokens

**Important Notes:**
⚠️ Configuration changes require starting a new Codex session to take effect
⚠️ API pricing changes for inputs exceeding 272K tokens
⚠️ `gpt-5.6-sol` model access depends on your account permissions

**Alternative Methods:**
- CLI: `npx codex-1m on/off/status`
- Profile: `codex --profile 1m`
- MCP tools: `toggle_1m_context` / `context_status`

See the repository README and `docs/gui-integration.md` for details.
