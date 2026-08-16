---
description: Route 1M on, 1M off, and 1M state
---

# 1M Context Toggle

Recognize these commands after trimming whitespace. Matching is
case-insensitive, so `1m on`, `1M ON`, and equivalent casing are valid:

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

**Alternative Methods:**
- Chat: `1M on` / `1M off` / `1M state` (case-insensitive)
- CLI: `npx codex-1m on/off/state`
- Profile: `codex --profile 1m`
- MCP tools: `toggle_1m_context` / `context_status`

See the repository README and `docs/gui-integration.md` for details.
