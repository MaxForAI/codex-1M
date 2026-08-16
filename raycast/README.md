# Raycast Script Command

`Codex-1M-Toggle.swift` is a compact Raycast Script Command. It delegates to
`scripts/codex-1m-action`; it never edits TOML with regular expressions.

## Install

```bash
cd ~/dev/codex-1m
npm install
npm run build
chmod +x scripts/codex-1m-action raycast/Codex-1M-Toggle.swift
```

In Raycast Settings > Extensions > Script Commands, add
`~/dev/codex-1m/raycast` as a script directory. Search for “Toggle Codex 1M
Context” and assign a global hotkey such as Command-Shift-M.

Direct read-only check:

```bash
./raycast/Codex-1M-Toggle.swift status
```

The default invocation toggles global mode. You may also run `on`, `off`, or
`status` explicitly. `on`/`off` create a config backup through the project CLI.
Start a new Codex chat/session after changing the setting.

Raycast Script Commands and custom hotkeys do not require Raycast Pro.

For macOS Shortcuts, add a “Run Shell Script” action calling
`~/dev/codex-1m/scripts/codex-1m-action on` (or `off`/`status`) and assign the
Shortcut a keyboard shortcut.
