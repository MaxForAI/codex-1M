import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('bundled MCP server install/uninstall routes', () => {
  let tempDir: string;
  let codexHome: string;
  let fakeCodex: string;
  let client: Client;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-1m-mcp-test-'));
    codexHome = path.join(tempDir, '.codex');
    fakeCodex = path.join(tempDir, 'fake-codex.js');
    fs.writeFileSync(fakeCodex, `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const statePath = path.join(process.env.CODEX_HOME, 'fake-plugin-state.json');
fs.mkdirSync(process.env.CODEX_HOME, { recursive: true });
let state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { marketplace: false, plugin: false, version: '1.7.0' };
const args = process.argv.slice(2).join(' ');
if (args === '--version') { process.stdout.write('codex-cli 0.test'); process.exit(0); }
let output = { ok: true };
if (args === 'plugin marketplace list --json') output = { marketplaces: state.marketplace ? [{ name: 'codex-1m', marketplaceSource: { repo: 'MaxForAI/codex-1M' } }] : [] };
else if (args === 'plugin list --json') output = { installed: state.plugin ? [{ pluginId: 'codex-1m@codex-1m', version: state.version }] : [] };
else if (args === 'plugin marketplace add MaxForAI/codex-1M --json') state.marketplace = true;
else if (args === 'plugin marketplace upgrade codex-1m --json') { state.marketplace = true; state.version = '1.8.0'; }
else if (args === 'plugin add codex-1m@codex-1m --json') state.plugin = true;
else if (args === 'plugin remove codex-1m@codex-1m --json') state.plugin = false;
else if (args === 'plugin marketplace remove codex-1m --json') state.marketplace = false;
else { console.error('unexpected command: ' + args); process.exit(2); }
fs.writeFileSync(statePath, JSON.stringify(state));
process.stdout.write(JSON.stringify(output));
`, 'utf8');
    fs.chmodSync(fakeCodex, 0o755);
  });

  afterEach(async () => {
    if (client) await client.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('lists all tools and executes install, update, doctor, state, and uninstall', async () => {
    const env = Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
    );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(process.cwd(), 'mcp', 'server.cjs')],
      env: { ...env, CODEX_HOME: codexHome, CODEX_BIN: fakeCodex },
      stderr: 'pipe',
    });
    client = new Client({ name: 'codex-1m-test', version: '1.0.0' });
    await client.connect(transport);

    const listed = await client.listTools();
    const install = listed.tools.find((tool) => tool.name === 'install_1m');
    const update = listed.tools.find((tool) => tool.name === 'update_1m');
    const doctor = listed.tools.find((tool) => tool.name === 'doctor_1m');
    const uninstall = listed.tools.find((tool) => tool.name === 'uninstall_1m');
    expect(install?.description).toContain('1m install');
    expect(update?.description).toContain('1m update');
    expect(doctor?.description).toContain('1m doctor');
    expect(uninstall?.description).toContain('1m uninstall');

    const installed = await client.callTool({ name: 'install_1m', arguments: {} });
    expect(installed.isError).not.toBe(true);
    expect(JSON.stringify(installed.content)).toContain('1m install complete');
    const configAfterInstall = fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8');
    expect(configAfterInstall).not.toContain('[mcp_servers.codex-1m]');
    expect(fs.existsSync(path.join(codexHome, 'prompts'))).toBe(false);

    const updated = await client.callTool({ name: 'update_1m', arguments: {} });
    expect(updated.isError).not.toBe(true);
    expect(JSON.stringify(updated.content)).toContain('Installed plugin version: 1.8.0');

    const diagnosed = await client.callTool({ name: 'doctor_1m', arguments: {} });
    const doctorText = JSON.stringify(diagnosed.content);
    expect(doctorText).toContain('Codex CLI version: codex-cli 0.test');
    expect(doctorText).toContain('Configuration mode: not configured');
    expect(doctorText).toContain('1m.config.toml: missing');
    expect(doctorText).toContain('codex-1m-state.json: missing');

    const status = await client.callTool({ name: 'context_status', arguments: {} });
    const statusText = JSON.stringify(status.content);
    expect(statusText).toContain('1M Configured: No');
    expect(statusText).toContain('Global configuration: disabled');
    expect(statusText).toContain('1M profile file: missing');
    expect(statusText).toContain('Current conversation: unknown');
    expect(statusText).not.toContain('1M Enabled');

    const removed = await client.callTool({ name: 'uninstall_1m', arguments: {} });
    expect(removed.isError).not.toBe(true);
    expect(JSON.stringify(removed.content)).toContain('codex-1m install');
    expect(fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8'))
      .not.toContain('[mcp_servers.codex-1m]');
    expect(fs.existsSync(path.join(codexHome, 'prompts', '1m.md'))).toBe(false);
  }, 30000);
});
