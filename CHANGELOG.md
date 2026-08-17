# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.8.0] - 2026-08-17

### Added

- GitHub Actions CI across Node.js 18, 20, and 22 on Linux and macOS, including
  install, build, test, production dependency audit, and package verification.
- Optional real-Codex E2E coverage using an isolated `CODEX_HOME` for the full
  install, update, doctor, on, off, state, and uninstall lifecycle, plus format,
  permission, and concurrent-write assertions.
- Security policy, release history, repository badges, and demo GIF guidance.

### Changed

- User-facing status wording consistently distinguishes a configured 1M file
  from the context window attached to a running conversation.

## 1.7.0 - 2026-08-17

- Added transactional lifecycle handling, `1m update`, and `1m doctor`.
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
