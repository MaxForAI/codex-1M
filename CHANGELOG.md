# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-08-17

### Changed

- Reordered the README to lead with codex-1M's value, one-command install, and
  five-command workflow. The complete ~828K usable-window disclosure, verified
  limit chain, and fact/inference distinction are unchanged in substance and
  moved intact to a dedicated later section.
- Reframed plugin descriptions around long-context capability while retaining
  the actual usable limit in the long description.
- Replaced README prose-coupled routing assertions with semantic checks for the
  five command rows, limit values, safety files, state fields, and explicit
  profile workflow.

## [2.0.0] - 2026-08-17

### Breaking changes

- `1m on` and `1m off` now operate on global Codex configuration by default so
  new Codex Desktop tasks receive the setting. Profile mode is now explicit via
  `--profile`; `--global` remains a compatibility alias for the default.
- Removed the `1m update` and `1m doctor` terminal commands in 2.0.0 and their
  `update_1m` and `doctor_1m` MCP tools. The supported command set is now
  install, uninstall, on, off, and state.

### Added

- Repeated `1m install` now refreshes the marketplace and reinstalls the latest
  plugin, absorbing the previous upgrade path.
- First install creates the owner-read-only
  `$CODEX_HOME/codex-1m-pristine.toml` escape hatch and never overwrites it.
  Uninstall preserves and reports this file instead of using it for automatic
  full-config restoration.
- State output distinguishes the 1,000,000-token configured request from the
  verified ~828,400 usable window and ~784,800 effective compaction threshold.

### Changed

- README and plugin metadata now lead with ~828K usable input and document the
  verified 872,000 × 95% limit chain separately from the inference that 128K is
  reserved for maximum output.
- Global rollback continues to use the key-level state snapshot and refuses to
  restore when a managed value was changed by the user.

## [1.8.0] - 2026-08-17

### Added

- GitHub Actions CI across Node.js 18, 20, and 22 on Linux and macOS, including
  install, build, test, production dependency audit, and package verification.
- Optional real-Codex E2E coverage using an isolated `CODEX_HOME` for the full
  plugin and configuration lifecycle, plus format,
  permission, and concurrent-write assertions.
- Security policy, release history, repository badges, and demo GIF guidance.

### Changed

- User-facing status wording consistently distinguishes a configured 1M file
  from the context window attached to a running conversation.

## 1.7.0 - 2026-08-17

- Added transactional plugin lifecycle handling and read-only diagnostics.
- Moved MCP and command routing into the plugin manifest and formal Skill.
- Synchronized CLI, MCP, and plugin versions from `package.json` at build time.

## 1.6.0 - 2026-08-17

- Migrated profiles to `$CODEX_HOME/1m.config.toml` for Codex's V2 profile protocol.
- Added safe global rollback state, conflict detection, atomic writes, file
  locking, and surgical TOML patches that preserve unrelated formatting.

## 1.5.0 - 2026-08-17

- Added conversational install and uninstall tools and case-insensitive command routing.

## 1.4.0 - 2026-08-17

- Unified terminal and conversation commands under the `1m` lifecycle vocabulary.

## 1.3.0 - 2026-08-17

- Added safe, idempotent removal of managed configuration and integration files.

## 1.2.0 - 2026-08-17

- Added concise in-conversation `1M on`, `1M off`, and state commands.

## 1.1.0 - 2026-08-17

- Packaged codex-1M as a Codex plugin with a bundled MCP server.

## 1.0.0 - 2026-08-17

- Initial CLI for configuring a 1M-token Codex profile or global settings.

[1.8.0]: https://github.com/MaxForAI/codex-1M/releases/tag/v1.8.0
[2.0.0]: https://github.com/MaxForAI/codex-1M/releases/tag/v2.0.0
[2.0.1]: https://github.com/MaxForAI/codex-1M/releases/tag/v2.0.1
