# codex-1M

Enable long context for Codex with one command.

```bash
npx --yes github:MaxForAI/codex-1M
```

This automatically backs up your Codex config and enables:

```toml
model = "gpt-5.6-sol"
model_context_window = 1000000
model_auto_compact_token_limit = 900000
```

Restart Codex after installation.

## Uninstall

```bash
npx --yes github:MaxForAI/codex-1M uninstall
```

Note: Codex caps the actual usable input window at ~828K.
Caveat: Your account and workspace must have access to `gpt-5.6-sol`.
