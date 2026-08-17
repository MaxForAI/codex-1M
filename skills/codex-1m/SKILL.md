---
name: codex-1m
description: Use when the user enters one of the five codex-1M commands: 1m install, 1m uninstall, 1m on, 1m off, or 1m state. Matching is case-insensitive.
---

# Codex 1M commands

Route the following exact commands case-insensitively to the plugin MCP tools:

- `1m install`: call `install_1m`.
- `1m uninstall`: call `uninstall_1m`.
- `1m on`: call `toggle_1m_context` with `enable=true`; global mode is the default. Pass `profile=true` only when the user explicitly requests profile mode.
- `1m off`: call `toggle_1m_context` with `enable=false`; global mode is the default. Pass `profile=true` only when the user explicitly requests profile mode.
- `1m state`: call `context_status`.

Return the tool result faithfully. Remind the user to start a new Codex conversation after install, uninstall, on, or off when the tool output asks for it. Explain that 1,000,000 is the configured request and the expected usable input window is approximately 828,400 tokens.
