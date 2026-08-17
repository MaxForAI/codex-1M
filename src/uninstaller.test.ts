import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigManager, CodexConfig } from './config-manager';
import { ConfigModifier } from './config-modifier';
import { uninstallLocalArtifacts } from './uninstaller';

describe('uninstall', () => {
  let tempDir: string;
  let codexHome: string;
  let configPath: string;
  let manager: ConfigManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-1m-uninstall-test-'));
    codexHome = path.join(tempDir, '.codex');
    configPath = path.join(codexHome, 'config.toml');
    manager = new ConfigManager(configPath);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('removes only codex-1m TOML settings and creates a restorable backup', () => {
    const original: CodexConfig = {
      model: 'gpt-5.6-sol',
      model_context_window: 1000000,
      model_auto_compact_token_limit: 900000,
      approval_policy: 'never',
      profiles: {
        '1m': {
          model: 'gpt-5.6-sol',
          model_context_window: 1000000,
          model_auto_compact_token_limit: 900000,
        },
        work: { model: 'gpt-5.6-terra' },
      },
      mcp_servers: {
        'codex-1m': { command: process.execPath, args: ['/tmp/mcp-server.js'] },
        github: { command: 'github-mcp' },
      },
      plugins: {
        'codex-1m@codex-1m': { enabled: true },
      },
      marketplaces: {
        'codex-1m': { source_type: 'local', source: '/tmp/codex-1m' },
      },
    };
    manager.writeConfig(original);

    const result = uninstallLocalArtifacts(manager, codexHome);
    const finalConfig = manager.readConfig();

    expect(result.config.removed).toEqual([
      'model',
      'model_context_window',
      'model_auto_compact_token_limit',
      'profiles.1m',
      'mcp_servers.codex-1m',
    ]);
    expect(result.backupPath).not.toBeNull();
    expect(fs.existsSync(result.backupPath!)).toBe(true);
    expect(new ConfigManager(result.backupPath!).readConfig()).toEqual(original);

    expect(finalConfig.model).toBeUndefined();
    expect(finalConfig.model_context_window).toBeUndefined();
    expect(finalConfig.model_auto_compact_token_limit).toBeUndefined();
    expect(finalConfig.profiles).toEqual({ work: { model: 'gpt-5.6-terra' } });
    expect(finalConfig.mcp_servers).toEqual({ github: { command: 'github-mcp' } });
    expect(finalConfig.approval_policy).toBe('never');
    // These are removed by the verified official Codex plugin commands, not by
    // guessing at their internal representation in the TOML cleanup layer.
    expect(finalConfig.plugins).toEqual(original.plugins);
    expect(finalConfig.marketplaces).toEqual(original.marketplaces);
  });

  it('preserves top-level settings unless the complete managed 1M signature matches', () => {
    const userConfig: CodexConfig = {
      model: 'gpt-5.6-sol',
      model_context_window: 750000,
      model_auto_compact_token_limit: 600000,
      profiles: { personal: { model: 'gpt-5.6-luna' } },
    };
    manager.writeConfig(userConfig);

    const result = uninstallLocalArtifacts(manager, codexHome);

    expect(result.config.changed).toBe(false);
    expect(result.backupPath).toBeNull();
    expect(manager.readConfig()).toEqual(userConfig);
  });

  it('removes recognized prompts but preserves same-named user content', () => {
    const promptDir = path.join(codexHome, 'prompts');
    fs.mkdirSync(promptDir, { recursive: true });
    const managedPrompt = path.join(promptDir, '1m.md');
    const userPrompt = path.join(promptDir, '1m-toggle.md');
    const unrelatedPrompt = path.join(promptDir, 'review.md');
    fs.writeFileSync(
      managedPrompt,
      '# 1M Context Toggle\nUse the MCP tools to change context.',
      'utf8'
    );
    fs.writeFileSync(userPrompt, '# My personal prompt\nDo not remove.', 'utf8');
    fs.writeFileSync(unrelatedPrompt, '# Review', 'utf8');

    const result = uninstallLocalArtifacts(manager, codexHome);

    expect(result.removedPrompts).toEqual([managedPrompt]);
    expect(result.preservedPrompts).toEqual([userPrompt]);
    expect(fs.existsSync(managedPrompt)).toBe(false);
    expect(fs.readFileSync(userPrompt, 'utf8')).toContain('Do not remove');
    expect(fs.existsSync(unrelatedPrompt)).toBe(true);
  });

  it('is idempotent and install can restore managed configuration afterward', () => {
    const modifier = new ConfigModifier(manager);
    modifier.enable1MContext(false);
    modifier.registerMCPServer();

    const first = uninstallLocalArtifacts(manager, codexHome);
    const configAfterFirst = fs.readFileSync(configPath, 'utf8');
    const second = uninstallLocalArtifacts(manager, codexHome);

    expect(first.config.changed).toBe(true);
    expect(second.config.changed).toBe(false);
    expect(second.backupPath).toBeNull();
    expect(fs.readFileSync(configPath, 'utf8')).toBe(configAfterFirst);

    modifier.enable1MContext(false);
    modifier.registerMCPServer();
    expect(manager.readConfig().profiles?.['1m']).toBeDefined();
    expect(manager.readConfig().mcp_servers?.['codex-1m']).toBeDefined();
  });
});
