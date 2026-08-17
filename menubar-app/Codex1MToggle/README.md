# Codex 1M macOS menu bar app

This is a native SwiftUI `MenuBarExtra` with explicit Configure, Remove, and
Refresh actions. It delegates configuration changes to
`scripts/codex-1m-action`, which in turn uses codex-1m's TOML-aware CLI.

## Local build

From the repository root:

```bash
npm install
npm run build
chmod +x scripts/codex-1m-action

swiftc -parse-as-library \
  -o /tmp/Codex1MToggle \
  menubar-app/Codex1MToggle/Codex1MToggleApp.swift \
  -framework SwiftUI -framework AppKit

CODEX_1M_HELPER="$PWD/scripts/codex-1m-action" /tmp/Codex1MToggle
```

The app also looks for the helper at `~/dev/codex-1m/scripts/codex-1m-action`,
which matches this repository's usual location.

For a distributable `.app`, create a macOS App target in Xcode, add
`Codex1MToggleApp.swift`, set `LSUIElement=true`, and copy the helper into the
app's Resources build phase. Public distribution needs signing and notarization.

## Behavior and safety

- Refresh/status is read-only.
- Configure and Remove change the **global** Codex settings and create CLI
  backups; they do not change the context already attached to a running chat.
- The app never parses or rewrites TOML itself.
- Start a new Codex chat/session after changing the configuration, then use
  `/status` to verify the context attached to it.
- The menu's keyboard mnemonics are not system-wide hotkeys. Use Raycast or
  macOS Shortcuts for a global shortcut.
