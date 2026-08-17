import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigManager } from './config-manager';
import {
  CodexCommandRunner,
  ConfigConflictError,
  formatInstallResult,
  formatUninstallResult,
  installCodex1M,
  uninstallCodex1M,
} from './installer';

class FakeRunner implements CodexCommandRunner {
  calls: string[][] = [];
  run(args: string[]) {
    this.calls.push(args);
    return { status: 0, stdout: 'removed' };
  }
}

describe('single-command installer', () => {
  let root: string;
  let codexHome: string;
  let configPath: string;
  let manager: ConfigManager;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-1m-installer-'));
    codexHome = path.join(root, '.codex');
    configPath = path.join(codexHome, 'config.toml');
    manager = new ConfigManager(configPath);
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('backs up and configures a newly created config', () => {
    const result = installCodex1M(manager);

    expect(fs.readFileSync(result.backupPath, 'utf8')).toBe('');
    expect(manager.readConfig()).toEqual({
      model: 'gpt-5.6-sol',
      model_context_window: 1000000,
      model_auto_compact_token_limit: 900000,
    });
    expect(formatInstallResult(result)).toContain(`Backup: ${result.backupPath}`);
    expect(formatInstallResult(result)).toContain('Restart Codex to apply.');
  });

  it('preserves unrelated settings, comments, and original key values', () => {
    const original = [
      '# keep this comment',
      'model = "gpt-user" # keep inline',
      'approval_policy = "never"',
      '',
      '[mcp_servers.github]',
      'command = "github-mcp"',
      '',
    ].join('\n');
    fs.writeFileSync(configPath, original);

    const result = installCodex1M(manager);
    const installed = fs.readFileSync(configPath, 'utf8');

    expect(fs.readFileSync(result.backupPath, 'utf8')).toBe(original);
    expect(installed).toContain('# keep this comment');
    expect(installed).toContain('model = "gpt-5.6-sol" # keep inline');
    expect(installed).toContain('[mcp_servers.github]\ncommand = "github-mcp"');
  });

  it('is idempotent and preserves the original snapshot and backup', () => {
    fs.writeFileSync(configPath, 'model = "original"\n');
    const first = installCodex1M(manager);
    const stateBefore = fs.readFileSync(manager.getStatePath(), 'utf8');
    const second = installCodex1M(manager);

    expect(second.idempotent).toBe(true);
    expect(second.backupPath).toBe(first.backupPath);
    expect(fs.readFileSync(manager.getStatePath(), 'utf8')).toBe(stateBefore);
    expect(fs.readdirSync(codexHome).filter((name) => name.startsWith('config.toml.bak.'))).toHaveLength(1);
  });

  it('restores only the three snapshotted keys on uninstall', () => {
    fs.writeFileSync(configPath, [
      '# original',
      'model = "gpt-original"',
      'model_context_window = 300000',
      'approval_policy = "never"',
      '',
    ].join('\n'));
    installCodex1M(manager);
    manager.patchConfig([{ type: 'set', key: 'sandbox_mode', value: 'workspace-write' }], false);
    const runner = new FakeRunner();

    const result = uninstallCodex1M({ manager, codexHome, runner });

    expect(manager.readConfig()).toEqual({
      model: 'gpt-original',
      model_context_window: 300000,
      approval_policy: 'never',
      sandbox_mode: 'workspace-write',
    });
    expect(result.backupPath).not.toBeNull();
    expect(fs.existsSync(manager.getStatePath())).toBe(false);
    expect(runner.calls).toEqual([
      ['plugin', 'remove', 'codex-1m@codex-1m'],
      ['plugin', 'marketplace', 'remove', 'codex-1m'],
    ]);
  });

  it('refuses uninstall after a managed value was changed and removes nothing', () => {
    installCodex1M(manager);
    manager.patchConfig([{ type: 'set', key: 'model', value: 'user-change' }], false);
    const profile = manager.getProfilePath();
    fs.writeFileSync(profile, 'legacy');
    const before = fs.readFileSync(configPath, 'utf8');
    const runner = new FakeRunner();

    expect(() => uninstallCodex1M({ manager, codexHome, runner })).toThrow(ConfigConflictError);
    expect(() => uninstallCodex1M({ manager, codexHome, runner })).toThrow(/user-modified setting.*model/i);
    expect(fs.readFileSync(configPath, 'utf8')).toBe(before);
    expect(fs.existsSync(profile)).toBe(true);
    expect(fs.existsSync(manager.getStatePath())).toBe(true);
    expect(runner.calls).toHaveLength(0);
  });

  it('cleans legacy remnants while deleting only recognized allowlisted prompts', () => {
    fs.writeFileSync(configPath, [
      'approval_policy = "never"',
      '',
      '[profiles.1m]',
      'model = "gpt-5.6-sol"',
      '',
      '[profiles.work]',
      'model = "gpt-work"',
      '',
      '[mcp_servers.codex-1m]',
      'command = "node"',
      '',
      '[mcp_servers.github]',
      'command = "github"',
      '',
    ].join('\n'));
    fs.writeFileSync(manager.getProfilePath(), 'legacy profile');
    fs.writeFileSync(manager.getPristinePath(), 'legacy pristine');
    fs.writeFileSync(manager.getStatePath(), 'legacy invalid state');
    const promptDirectory = path.join(codexHome, 'prompts');
    fs.mkdirSync(promptDirectory);
    fs.writeFileSync(path.join(promptDirectory, '1m.md'), '# 1M Context Toggle\nUse the MCP tools.');
    fs.writeFileSync(path.join(promptDirectory, '1m-toggle.md'), '# User-edited prompt\nKeep me.');
    fs.writeFileSync(path.join(promptDirectory, '1m-my-prompt.md'), '# User prompt');
    fs.writeFileSync(path.join(promptDirectory, '1m-custom.md'), '# 1M Context Toggle\nUse the MCP tools.');
    fs.writeFileSync(path.join(promptDirectory, 'other.md'), 'keep');

    const result = uninstallCodex1M({ manager, codexHome, runner: new FakeRunner() });
    const config = manager.readConfig();

    expect(config.profiles).toEqual({ work: { model: 'gpt-work' } });
    expect(config.mcp_servers).toEqual({ github: { command: 'github' } });
    expect(fs.existsSync(manager.getProfilePath())).toBe(false);
    expect(fs.existsSync(manager.getPristinePath())).toBe(false);
    expect(fs.existsSync(manager.getStatePath())).toBe(false);
    expect(fs.existsSync(path.join(promptDirectory, '1m.md'))).toBe(false);
    expect(fs.readFileSync(path.join(promptDirectory, '1m-toggle.md'), 'utf8')).toContain('User-edited');
    expect(fs.existsSync(path.join(promptDirectory, '1m-my-prompt.md'))).toBe(true);
    expect(fs.existsSync(path.join(promptDirectory, '1m-custom.md'))).toBe(true);
    expect(fs.readFileSync(path.join(promptDirectory, 'other.md'), 'utf8')).toBe('keep');
    expect(result.removed).toEqual(expect.arrayContaining([
      'profiles.1m',
      'mcp_servers.codex-1m',
      '1m.config.toml',
      'codex-1m-pristine.toml',
      'codex-1m-state.json',
      path.join('prompts', '1m.md'),
    ]));
    expect(result.preservedPrompts.map((filePath) => path.basename(filePath))).toEqual([
      '1m-custom.md',
      '1m-my-prompt.md',
      '1m-toggle.md',
    ]);
    expect(formatUninstallResult(result)).toContain('已保留未识别的 prompt 文件：1m-toggle.md');
    expect(formatUninstallResult(result)).toContain('已保留未识别的 prompt 文件：1m-my-prompt.md');
    expect(formatUninstallResult(result)).toContain('已保留未识别的 prompt 文件：1m-custom.md');
  });

  it('reports plugin cleanup as skipped when the Codex CLI is unavailable', () => {
    const result = uninstallCodex1M({ manager, codexHome, runner: null });
    expect(result.plugin).toEqual({ status: 'skipped', detail: 'Codex CLI not found' });
    expect(result.marketplace).toEqual({ status: 'skipped', detail: 'Codex CLI not found' });
  });
});
