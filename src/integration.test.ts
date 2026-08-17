import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigManager } from './config-manager';
import {
  CodexRunner,
  installCodex1M,
  PLUGIN_ID,
  uninstallCodex1M,
} from './integration';

class FakeCodexRunner implements CodexRunner {
  calls: string[][] = [];
  marketplaceInstalled = false;
  pluginInstalled = false;

  run(args: string[]): unknown {
    this.calls.push(args);
    const command = args.join(' ');
    if (command === 'plugin marketplace list --json') {
      return {
        marketplaces: this.marketplaceInstalled
          ? [{
              name: 'codex-1m',
              marketplaceSource: { source: 'github', repo: 'MaxForAI/codex-1M' },
            }]
          : [],
      };
    }
    if (command === 'plugin list --json') {
      return { installed: this.pluginInstalled ? [{ pluginId: PLUGIN_ID }] : [] };
    }
    if (command === 'plugin marketplace add MaxForAI/codex-1M --json') {
      this.marketplaceInstalled = true;
      return { ok: true };
    }
    if (command === `plugin add ${PLUGIN_ID} --json`) {
      this.pluginInstalled = true;
      return { ok: true };
    }
    if (command === `plugin remove ${PLUGIN_ID} --json`) {
      this.pluginInstalled = false;
      return { ok: true };
    }
    if (command === 'plugin marketplace remove codex-1m --json') {
      this.marketplaceInstalled = false;
      return { ok: true };
    }
    throw new Error(`Unexpected fake Codex command: ${command}`);
  }
}

describe('conversation install/uninstall implementation', () => {
  let tempDir: string;
  let codexHome: string;
  let manager: ConfigManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-1m-integration-test-'));
    codexHome = path.join(tempDir, '.codex');
    manager = new ConfigManager(path.join(codexHome, 'config.toml'));
  });

  afterEach(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  it('installs marketplace, plugin, MCP registration, and both prompts', () => {
    const runner = new FakeCodexRunner();
    const mcpServerPath = path.join(tempDir, 'server.cjs');
    const result = installCodex1M({ runner, configManager: manager, codexHome, mcpServerPath });

    expect(result.marketplace).toBe('added');
    expect(result.plugin).toBe('installed');
    expect(manager.readConfig().mcp_servers?.['codex-1m']).toEqual({
      command: process.execPath,
      args: [mcpServerPath],
      description: 'Toggle 1M context window from within Codex',
    });
    expect(result.prompts.written.map((file) => path.basename(file))).toEqual([
      '1m.md',
      '1m-toggle.md',
    ]);
    expect(fs.readFileSync(path.join(codexHome, 'prompts', '1m.md'), 'utf8'))
      .toContain('`1M install`: call `install_1m`');
  });

  it('is repair-safe and does not overwrite a same-named user prompt', () => {
    const runner = new FakeCodexRunner();
    runner.marketplaceInstalled = true;
    runner.pluginInstalled = true;
    const promptDir = path.join(codexHome, 'prompts');
    fs.mkdirSync(promptDir, { recursive: true });
    fs.writeFileSync(path.join(promptDir, '1m.md'), '# My private prompt', 'utf8');

    const result = installCodex1M({ runner, configManager: manager, codexHome });

    expect(result.marketplace).toBe('already configured');
    expect(result.plugin).toBe('already installed');
    expect(result.prompts.preserved).toEqual([path.join(promptDir, '1m.md')]);
    expect(fs.readFileSync(path.join(promptDir, '1m.md'), 'utf8')).toBe('# My private prompt');
  });

  it('fully uninstalls and leaves terminal reinstall as the recovery path', () => {
    const runner = new FakeCodexRunner();
    installCodex1M({ runner, configManager: manager, codexHome });

    const result = uninstallCodex1M({ runner, configManager: manager, codexHome });

    expect(result.local.config.removed).toContain('mcp_servers.codex-1m');
    expect(result.local.removedPrompts).toHaveLength(2);
    expect(result.plugin).toEqual({ plugin: 'removed', marketplace: 'removed' });
    expect(manager.readConfig().mcp_servers?.['codex-1m']).toBeUndefined();
    expect(runner.pluginInstalled).toBe(false);
    expect(runner.marketplaceInstalled).toBe(false);
  });
});
