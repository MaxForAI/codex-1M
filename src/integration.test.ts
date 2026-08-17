import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigManager } from './config-manager';
import {
  CodexRunner,
  installCodex1M,
  PLUGIN_ID,
  updateCodex1M,
  uninstallCodex1M,
} from './integration';

class FakeCodexRunner implements CodexRunner {
  calls: string[][] = [];
  marketplaceInstalled = false;
  pluginInstalled = false;
  version = '1.7.0';

  runText(args: string[]): string {
    this.calls.push(args);
    if (args.join(' ') === '--version') return 'codex-cli test';
    throw new Error(`Unexpected fake Codex command: ${args.join(' ')}`);
  }

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
      return {
        installed: this.pluginInstalled
          ? [{ pluginId: PLUGIN_ID, version: this.version }]
          : [],
      };
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
    if (command === 'plugin marketplace upgrade codex-1m --json') {
      this.version = '1.8.0';
      return { ok: true };
    }
    if (command === 'plugin marketplace remove codex-1m --json') {
      this.marketplaceInstalled = false;
      return { ok: true };
    }
    throw new Error(`Unexpected fake Codex command: ${command}`);
  }
}

describe('conversation install/update/uninstall implementation', () => {
  let tempDir: string;
  let codexHome: string;
  let manager: ConfigManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-1m-integration-test-'));
    codexHome = path.join(tempDir, '.codex');
    manager = new ConfigManager(path.join(codexHome, 'config.toml'));
  });

  afterEach(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  it('installs only the marketplace and plugin-provided integration', () => {
    const runner = new FakeCodexRunner();
    const result = installCodex1M({ runner });

    expect(result.marketplace).toBe('added');
    expect(result.plugin).toBe('installed');
    expect(result.integration).toBe('provided by plugin manifest');
    expect(manager.readConfig().mcp_servers?.['codex-1m']).toBeUndefined();
    expect(fs.existsSync(path.join(codexHome, 'prompts'))).toBe(false);
  });

  it('is repair-safe and does not touch a same-named user prompt', () => {
    const runner = new FakeCodexRunner();
    runner.marketplaceInstalled = true;
    runner.pluginInstalled = true;
    const promptDir = path.join(codexHome, 'prompts');
    fs.mkdirSync(promptDir, { recursive: true });
    fs.writeFileSync(path.join(promptDir, '1m.md'), '# My private prompt', 'utf8');

    const result = installCodex1M({ runner });

    expect(result.marketplace).toBe('already configured');
    expect(result.plugin).toBe('already installed');
    expect(fs.readFileSync(path.join(promptDir, '1m.md'), 'utf8')).toBe('# My private prompt');
  });

  it('upgrades the named marketplace and reinstalls an existing plugin', () => {
    const runner = new FakeCodexRunner();
    runner.marketplaceInstalled = true;
    runner.pluginInstalled = true;

    const result = updateCodex1M({ runner });

    expect(result).toEqual({
      marketplace: 'upgraded',
      plugin: 'reinstalled',
      installedVersion: '1.8.0',
    });
    expect(runner.calls.map((args) => args.join(' '))).toEqual([
      'plugin list --json',
      'plugin marketplace list --json',
      'plugin marketplace upgrade codex-1m --json',
      `plugin remove ${PLUGIN_ID} --json`,
      `plugin add ${PLUGIN_ID} --json`,
      'plugin list --json',
    ]);
  });

  it('fully uninstalls and leaves terminal reinstall as the recovery path', () => {
    const runner = new FakeCodexRunner();
    installCodex1M({ runner });

    const result = uninstallCodex1M({ runner, configManager: manager, codexHome });

    expect(result.local.config.changed).toBe(false);
    expect(result.local.removedPrompts).toHaveLength(0);
    expect(result.plugin).toEqual({ plugin: 'removed', marketplace: 'removed' });
    expect(manager.readConfig().mcp_servers?.['codex-1m']).toBeUndefined();
    expect(runner.pluginInstalled).toBe(false);
    expect(runner.marketplaceInstalled).toBe(false);
  });
});
