# codex-1m

**One command to unlock Codex's 1M-token context**

This project makes it dead simple to enable OpenAI Codex's massive 1M token context window with a single command, and lets you toggle it on/off from within Codex conversations using MCP tools.

## Quick Start

```bash
# Install and enable 1M context (creates a profile)
npx codex-1m on

# Start Codex with 1M context
codex --profile 1m

# Or enable globally (affects all sessions)
npx codex-1m on --global
```

## What It Does

`codex-1m` configures Codex to use `gpt-5.6-sol` with 1,050,000 token context window by setting these values in `~/.codex/config.toml`:

```toml
model = "gpt-5.6-sol"
model_context_window = 1000000
model_auto_compact_token_limit = 900000
```

## Three Ways to Use It

### 1. CLI Commands

```bash
# Enable 1M context (creates profile)
npx codex-1m on

# Enable globally (modifies top-level config)
npx codex-1m on --global

# Disable 1M context
npx codex-1m off

# Check current status
npx codex-1m status
```

### 2. Profile-Based (Recommended)

By default, `codex-1m` creates a `[profiles.1m]` profile so you can choose when to use 1M context:

```bash
codex --profile 1m
```

### 3. In-Chat MCP Toggle

Once installed, you can control 1M context from within Codex conversations:

- "Enable 1M context" → Turns on 1M context
- "Disable 1M context" → Turns off 1M context  
- "Check context status" → Shows current settings

*Note: Configuration changes require starting a new Codex session to take effect.*

## Caveats

⚠️ **Important considerations before using 1M context:**

- **Cost**: API pricing changes for inputs exceeding 272K tokens (higher rate applies). Subscription quota conversion isn't publicly documented.
- **Performance**: More context isn't always better. Larger contexts can be slower and more expensive.
- **Session Restart**: Configuration changes only take effect in new Codex sessions.
- **Model Availability**: `gpt-5.6-sol` access depends on your account permissions.
- **One-Time Trial**: Single-session use: `codex -m gpt-5.6-sol -c model_context_window=1000000 -c model_auto_compact_token_limit=900000`

## Installation Safety

- ✅ **Backups**: Every config modification creates timestamped backups (`.config.toml.bak.<timestamp>`)
- ✅ **Idempotent**: Safe to run multiple times
- ✅ **Preserves Existing Config**: Keeps your MCP servers, profiles, and other settings
- ✅ **Real TOML Parser**: Uses `@iarna/toml` (not regex) for reliable config manipulation

## Configuration Source

These settings are confirmed by Codex official (Tibo) for enabling the 1M token context window with `gpt-5.6-sol`.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions welcome! This is an open-source project to make Codex's 1M context accessible to everyone.
