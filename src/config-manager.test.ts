import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from './config-manager';
import {
  ConfigConflictError,
  ConfigModifier,
  formatConfigStatus,
} from './config-modifier';

describe('Codex configuration safety', () => {
  let tempDir: string;
  let configPath: string;
  let manager: ConfigManager;
  let modifier: ConfigModifier;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-1m-test-'));
    configPath = path.join(tempDir, 'config.toml');
    manager = new ConfigManager(configPath);
    modifier = new ConfigModifier(manager);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates a V2 profile beside config.toml without writing profiles.1m', () => {
    fs.writeFileSync(configPath, '# keep me\napproval_policy = "never"\n', 'utf8');

    modifier.enable1MContext(false);

    expect(manager.readConfig().profiles?.['1m']).toBeUndefined();
    expect(fs.readFileSync(configPath, 'utf8')).toBe(
      '# keep me\napproval_policy = "never"\n'
    );
    expect(manager.readTomlFile(manager.getProfilePath())).toMatchObject({
      model: 'gpt-5.6-sol',
      model_context_window: 1000000,
      model_auto_compact_token_limit: 900000,
    });
    expect(fs.readFileSync(manager.getProfilePath(), 'utf8')).toBe(
      'model = "gpt-5.6-sol"\n' +
      'model_context_window = 1000000\n' +
      'model_auto_compact_token_limit = 900000\n'
    );
  });

  it('defaults on and off to global snapshot-protected configuration', () => {
    fs.writeFileSync(configPath, 'model = "gpt-original"\napproval_policy = "never"\n', 'utf8');

    const enabled = modifier.enable1MContext();
    expect(enabled).toContain('Global Codex configuration modified');
    expect(enabled).toContain(manager.getBackupPath());
    expect(enabled).toContain(manager.getStatePath());
    expect(manager.readConfig()).toMatchObject({
      model: 'gpt-5.6-sol',
      model_context_window: 1000000,
      model_auto_compact_token_limit: 900000,
    });

    modifier.disable1MContext();
    expect(manager.readConfig()).toEqual({ model: 'gpt-original', approval_policy: 'never' });
  });

  it('respects CODEX_HOME for the V2 profile path', () => {
    const previous = process.env.CODEX_HOME;
    const codexHome = path.join(tempDir, 'custom-home');
    process.env.CODEX_HOME = codexHome;
    try {
      const defaultManager = new ConfigManager();
      new ConfigModifier(defaultManager).enable1MContext(false);
      expect(fs.existsSync(path.join(codexHome, '1m.config.toml'))).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = previous;
    }
  });

  it('migrates legacy profiles.1m after backing up and preserves comments/other profiles', () => {
    const legacy = [
      '# user comment',
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
    ].join('\n');
    fs.writeFileSync(configPath, legacy, 'utf8');

    const message = modifier.enable1MContext(false);

    expect(message).toContain('Migrated legacy [profiles.1m]');
    expect(fs.existsSync(manager.getBackupPath())).toBe(true);
    expect(fs.readFileSync(manager.getBackupPath(), 'utf8')).toBe(legacy);
    expect(manager.readConfig().profiles).toEqual({ work: { model: 'gpt-5.6-terra' } });
    expect(fs.readFileSync(configPath, 'utf8')).toContain('# user comment');
    expect(manager.readTomlFile(manager.getProfilePath()).model_context_window).toBe(1000000);
  });

  it('removes the V2 profile on off and reports the three independent state fields', () => {
    modifier.enable1MContext(false);
    expect(modifier.getStatus()).toEqual({
      configured: true,
      globalConfiguration: 'disabled',
      profileFile: 'available',
      currentConversation: 'unknown',
    });
    expect(formatConfigStatus(modifier.getStatus())).toBe([
      '1M Configured: Yes',
      'Global configuration: disabled',
      '1M profile file: available',
      'Requested context window: 1,000,000 tokens (configured request)',
      'Expected usable window: ~828,400 tokens (server limit 872,000 × 95%)',
      'Auto-compact: configured 900,000 → expected effective ~784,800 tokens',
      'Current conversation: unknown (start a new conversation and use /status to verify)',
    ].join('\n'));

    modifier.disable1MContext(false);
    expect(fs.existsSync(manager.getProfilePath())).toBe(false);
    expect(modifier.getStatus().profileFile).toBe('missing');
  });

  it('snapshots original global values including missing markers and restores them', () => {
    fs.writeFileSync(
      configPath,
      '# original comment\nmodel = "gpt-user" # retain comment\napproval_policy = "never"\n',
      'utf8'
    );

    modifier.enable1MContext(true);
    const state = JSON.parse(fs.readFileSync(manager.getStatePath(), 'utf8'));
    expect(state).toMatchObject({
      version: 1,
      original: {
        model: { existed: true, value: 'gpt-user' },
        model_context_window: { existed: false },
        model_auto_compact_token_limit: { existed: false },
      },
      managed: {
        model: 'gpt-5.6-sol',
        model_context_window: 1000000,
        model_auto_compact_token_limit: 900000,
      },
    });
    expect(manager.readConfig().model).toBe('gpt-5.6-sol');
    expect(fs.readFileSync(configPath, 'utf8')).toContain('# original comment');

    modifier.disable1MContext(true);
    expect(manager.readConfig()).toEqual({ model: 'gpt-user', approval_policy: 'never' });
    expect(fs.readFileSync(configPath, 'utf8')).toContain('# retain comment');
    expect(fs.existsSync(manager.getStatePath())).toBe(false);
  });

  it('creates exactly one original-state backup per global on/off transaction', () => {
    const original = '# original\nmodel = "gpt-user"\napproval_policy = "never"\n';
    fs.writeFileSync(configPath, original, 'utf8');

    modifier.enable1MContext(true);
    let backups = fs.readdirSync(tempDir).filter((name) => name.startsWith('config.toml.bak.'));
    expect(backups).toHaveLength(1);
    expect(fs.readFileSync(path.join(tempDir, backups[0]), 'utf8')).toBe(original);

    const beforeOff = fs.readFileSync(configPath, 'utf8');
    modifier.disable1MContext(true);
    backups = fs.readdirSync(tempDir).filter((name) => name.startsWith('config.toml.bak.'));
    expect(backups).toHaveLength(2);
    const newest = backups.find((name) => fs.readFileSync(path.join(tempDir, name), 'utf8') === beforeOff);
    expect(newest).toBeDefined();
  });

  it('stops global off on a user edit and leaves config/state untouched', () => {
    modifier.enable1MContext();
    manager.patchConfig([{ type: 'set', key: 'model', value: 'gpt-user-after-enable' }]);
    const before = fs.readFileSync(configPath, 'utf8');
    const stateBefore = fs.readFileSync(manager.getStatePath(), 'utf8');

    expect(() => modifier.disable1MContext()).toThrow(ConfigConflictError);
    expect(() => modifier.disable1MContext()).toThrow(/user-modified global setting.*model/i);
    expect(fs.readFileSync(configPath, 'utf8')).toBe(before);
    expect(fs.readFileSync(manager.getStatePath(), 'utf8')).toBe(stateBefore);
  });

  it('uses surgical patches for managed tables and leaves unrelated formatting intact', () => {
    const original = [
      '# top comment',
      'approval_policy   =   "never" # custom spacing',
      '',
      '[mcp_servers.other]',
      '# nested comment',
      'command = "other"',
      '',
    ].join('\n');
    fs.writeFileSync(configPath, original, 'utf8');

    manager.patchConfig([{
      type: 'set-table',
      path: ['mcp_servers', 'codex-1m'],
      value: { command: '/usr/bin/node', args: ['/plugin/server.cjs'] },
    }]);
    const updated = fs.readFileSync(configPath, 'utf8');

    expect(updated).toContain('# top comment');
    expect(updated).toContain('approval_policy   =   "never" # custom spacing');
    expect(updated).toContain('# nested comment');
    expect(manager.readConfig().mcp_servers?.other.command).toBe('other');
    expect(manager.readConfig().mcp_servers?.['codex-1m'].args).toEqual(['/plugin/server.cjs']);
    expect(fs.readdirSync(tempDir).some((name) => name.includes('.tmp-'))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, '.codex-1m.lock'))).toBe(false);
  });
});
