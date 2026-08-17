import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { doctorCodex1M, formatDoctorResult } from './doctor';
import { CodexRunner, PLUGIN_ID } from './integration';

class DoctorRunner implements CodexRunner {
  constructor(
    private marketplaceRoot: string,
    private pluginRoot: string,
  ) {}

  runText(args: string[]): string {
    if (args.join(' ') === '--version') return 'codex-cli 0.148.0-alpha.9';
    throw new Error(`unexpected: ${args.join(' ')}`);
  }

  run(args: string[]): unknown {
    const command = args.join(' ');
    if (command === 'plugin marketplace list --json') {
      return { marketplaces: [{ name: 'codex-1m', root: this.marketplaceRoot }] };
    }
    if (command === 'plugin list --json') {
      return {
        installed: [{
          pluginId: PLUGIN_ID,
          version: '1.7.0',
          installedPath: this.pluginRoot,
        }],
      };
    }
    throw new Error(`unexpected: ${command}`);
  }
}

describe('1m doctor', () => {
  let tempDir: string;
  let codexHome: string;
  let marketplaceRoot: string;
  let pluginRoot: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-1m-doctor-test-'));
    codexHome = path.join(tempDir, '.codex');
    marketplaceRoot = path.join(tempDir, 'marketplace');
    pluginRoot = path.join(tempDir, 'plugin');
    fs.mkdirSync(path.join(marketplaceRoot, '.codex-plugin'), { recursive: true });
    fs.mkdirSync(path.join(pluginRoot, 'mcp'), { recursive: true });
    fs.mkdirSync(codexHome, { recursive: true });
    fs.writeFileSync(
      path.join(marketplaceRoot, '.codex-plugin', 'plugin.json'),
      JSON.stringify({ version: '1.8.0' })
    );
    fs.writeFileSync(path.join(pluginRoot, 'mcp', 'server.cjs'), '// server');
  });

  afterEach(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  it('reports every required diagnostic and profile mode without writing config', () => {
    const profilePath = path.join(codexHome, '1m.config.toml');
    fs.writeFileSync(profilePath, [
      'model = "gpt-5.6-sol"',
      'model_context_window = 1000000',
      'model_auto_compact_token_limit = 900000',
      '',
    ].join('\n'));
    const runner = new DoctorRunner(marketplaceRoot, pluginRoot);
    const result = doctorCodex1M({ runner, codexHome });
    const output = formatDoctorResult(result);

    expect(output).toContain('Codex CLI version: codex-cli 0.148.0-alpha.9');
    expect(output).toContain('Repository/remote version: 1.8.0');
    expect(output).toContain('Installed plugin version: 1.7.0');
    expect(output).toContain('Configuration mode: profile file');
    expect(output).toContain(`MCP server path: ${path.join(pluginRoot, 'mcp', 'server.cjs')}`);
    expect(output).toContain('MCP server exists: yes');
    expect(output).toContain('MCP server executable: yes (via Node.js)');
    expect(output).toContain('1m.config.toml: exists');
    expect(output).toContain('codex-1m-state.json: missing');
    expect(fs.existsSync(path.join(codexHome, 'config.toml'))).toBe(false);
  });
});
