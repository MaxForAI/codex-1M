---
name: codex-1m
description: Use when the user enters a codex-1M command such as 1m install, 1m update, 1m doctor, 1m uninstall, 1m on, 1m off, or 1m state. Matching is case-insensitive.
---

# Codex 1M commands

Route the following exact commands case-insensitively to the plugin MCP tools:

- `1m install`: call `install_1m`.
- `1m update`: call `update_1m`.
- `1m doctor`: call `doctor_1m`.
- `1m uninstall`: call `uninstall_1m`.
- `1m on`: call `toggle_1m_context` with `enable=true` and `global=false` unless the user explicitly asks for global mode.
- `1m off`: call `toggle_1m_context` with `enable=false` and `global=false` unless the user explicitly asks for global mode.
- `1m state`: call `context_status`.

Return the tool result faithfully. Remind the user to start a new Codex conversation after install, update, uninstall, on, or off when the tool output asks for it.
