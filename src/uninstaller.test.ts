import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigManager } from './config-manager';
import { ConfigConflictError, ConfigModifier } from './config-modifier';
import { uninstallLocalArtifacts } from './uninstaller';

describe('uninstall', () => {
  let tempDir: string;
  let codexHome: string;
  let configPath: string;
  let manager: ConfigManager;
  let modifier: ConfigModifier;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-1m-uninstall-test-'));
    codexHome = path.join(tempDir, '.codex');
    configPath = path.join(codexHome, 'config.toml');
    manager = new ConfigManager(configPath);
    modifier = new ConfigModifier(manager);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('removes the V2 profile, legacy profile, MCP table and managed prompt only', () => {
    fs.writeFileSync(configPath, [
      '# keep config comment',
      'approval_policy = "never"',
      '',
      '[profiles.1m]',
      'model = "gpt-5.6-sol"',
      'model_context_window = 1000000',
      'model_auto_compact_token_limit = 900000',
      '',
      '[profiles.work]',
      'model = "gpt-5.6-terra"',
      '',
      '[mcp_servers.codex-1m]',
      'command = "node"',
      '',
      '[mcp_servers.github]',
      'command = "github-mcp"',
      '',
    ].join('\n'), 'utf8');
    modifier.enable1MContext(false); // migrates legacy to the V2 file

    const promptDir = path.join(codexHome, 'prompts');
    fs.mkdirSync(promptDir, { recursive: true });
    const managedPrompt = path.join(promptDir, '1m.md');
    const userPrompt = path.join(promptDir, '1m-toggle.md');
    fs.writeFileSync(managedPrompt, '# 1M Context Toggle\nUse the MCP tools.', 'utf8');
    fs.writeFileSync(userPrompt, '# User file\nKeep me.', 'utf8');

    const result = uninstallLocalArtifacts(manager, codexHome);
    const finalConfig = manager.readConfig();

    expect(result.config.removed).toEqual([
      'mcp_servers.codex-1m',
      '1m.config.toml',
    ]);
    expect(result.backupPath).not.toBeNull();
    expect(fs.existsSync(manager.getProfilePath())).toBe(false);
    expect(finalConfig.profiles).toEqual({ work: { model: 'gpt-5.6-terra' } });
    expect(finalConfig.mcp_servers).toEqual({ github: { command: 'github-mcp' } });
    expect(finalConfig.approval_policy).toBe('never');
    expect(fs.readFileSync(configPath, 'utf8')).toContain('# keep config comment');
    expect(result.removedPrompts).toEqual([managedPrompt]);
    expect(result.preservedPrompts).toEqual([userPrompt]);
  });

  it('restores the global snapshot during uninstall instead of deleting user originals', () => {
    manager.patchConfig([
      { type: 'set', key: 'model', value: 'gpt-original' },
      { type: 'set', key: 'model_context_window', value: 400000 },
    ]);
    modifier.enable1MContext(true);
    modifier.registerMCPServer('/usr/bin/node', ['/plugin/server.cjs']);

    const result = uninstallLocalArtifacts(manager, codexHome);

    expect(result.config.removed).toContain('global 1M values (snapshot restored)');
    expect(manager.readConfig()).toMatchObject({
      model: 'gpt-original',
      model_context_window: 400000,
    });
    expect(manager.readConfig().model_auto_compact_token_limit).toBeUndefined();
    expect(fs.existsSync(manager.getStatePath())).toBe(false);
  });

  it('stops uninstall on a global conflict before deleting config, profile, or prompts', () => {
    modifier.enable1MContext(true);
    modifier.enable1MContext(false);
    manager.patchConfig([{ type: 'set', key: 'model', value: 'user-changed-model' }]);
    const promptDir = path.join(codexHome, 'prompts');
    fs.mkdirSync(promptDir, { recursive: true });
    const prompt = path.join(promptDir, '1m.md');
    fs.writeFileSync(prompt, '# 1M Context Toggle\nUse the MCP tools.', 'utf8');
    const configBefore = fs.readFileSync(configPath, 'utf8');

    expect(() => uninstallLocalArtifacts(manager, codexHome)).toThrow(ConfigConflictError);
    expect(fs.readFileSync(configPath, 'utf8')).toBe(configBefore);
    expect(fs.existsSync(manager.getStatePath())).toBe(true);
    expect(fs.existsSync(manager.getProfilePath())).toBe(true);
    expect(fs.existsSync(prompt)).toBe(true);
  });

  it('is idempotent and a later on recreates only the V2 profile', () => {
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
    expect(fs.existsSync(manager.getProfilePath())).toBe(true);
    expect(manager.readConfig().profiles?.['1m']).toBeUndefined();
  });
});
