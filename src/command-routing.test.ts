import * as fs from 'fs';
import * as path from 'path';
import { normalizeCommandCase, program } from './cli';
import { MCP_TOOLS } from './mcp-tools';

describe('short command routing', () => {
  it('advertises the exact chat commands in MCP tool descriptions', () => {
    const install = MCP_TOOLS.find((tool) => tool.name === 'install_1m');
    const uninstall = MCP_TOOLS.find((tool) => tool.name === 'uninstall_1m');
    const toggle = MCP_TOOLS.find((tool) => tool.name === 'toggle_1m_context');
    const state = MCP_TOOLS.find((tool) => tool.name === 'context_status');

    expect(install?.description).toContain('1m install');
    expect(install?.description).toContain('case-insensitive');
    expect(uninstall?.description).toContain('1m uninstall');
    expect(uninstall?.description).toContain('case-insensitive');
    expect(toggle?.description).toContain('1M on');
    expect(toggle?.description).toContain('1M off');
    expect(toggle?.description).toContain('case-insensitive');
    expect(state?.description).toContain('1M state');
    expect(state?.description).toContain('case-insensitive');
  });

  it('uses state as the only status command', () => {
    const state = program.commands.find((command) => command.name() === 'state');

    expect(state).toBeDefined();
    expect(state?.aliases()).toEqual([]);
  });

  it('declares both executable names and exactly five unified subcommands', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
    );

    expect(packageJson.bin['1m']).toBe('./dist/cli.js');
    expect(packageJson.bin['codex-1m']).toBe('./dist/cli.js');
    expect(program.name()).toBe('1m');
    expect(program.commands.map((command) => command.name())).toEqual(
      ['on', 'off', 'state', 'install', 'uninstall']
    );
    const manifest = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), '.codex-plugin', 'plugin.json'), 'utf8')
    );
    expect(manifest.version).toBe(packageJson.version);
  });

  it('documents one bootstrap and the unified command table without legacy npx commands', () => {
    const readme = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf8');

    expect(readme).toContain('## In Codex conversation');
    expect(readme).toContain('npx --yes github:MaxForAI/codex-1M install');
    expect(readme).toContain('Fallback');
    expect(readme).toContain('| `1m install` | `install_1m` |');
    expect(readme).toContain('| `1m uninstall` | `uninstall_1m` |');
    expect(readme).toContain('| `1m on` | `toggle_1m_context(enable=true)` |');
    expect(readme).toContain('| `1m off` | `toggle_1m_context(enable=false)` |');
    expect(readme).toContain('| `1m state` | `context_status` |');
    expect(readme).toContain('A full uninstall likewise removes that tool');
    expect(readme).toContain('Do not use `npx 1m`');
    expect(readme).toContain('$CODEX_HOME/1m.config.toml');
    expect(readme).toContain('codex --profile 1m');
    expect(readme).toContain('codex-1m-state.json');
    expect(readme).toContain('codex-1m-pristine.toml');
    expect(readme).toContain('$CODEX_HOME/.codex-1m.lock');
    expect(readme).toContain('Global configuration: enabled');
    expect(readme).toContain('1M profile file: missing');
    expect(readme).toContain('Current conversation: unknown');
    expect(readme).toContain('1M Configured: Yes');
    expect(readme).toContain('Requested context window: 1,000,000');
    expect(readme).toContain('Expected usable window: ~828,400');
    expect(readme).toContain('Auto-compact: configured 900,000 → expected effective ~784,800');
  });

  it('routes all case-insensitive chat mappings from the plugin Skill', () => {
    const skill = fs.readFileSync(
      path.join(process.cwd(), 'skills', 'codex-1m', 'SKILL.md'),
      'utf8'
    );
    const manifest = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), '.codex-plugin', 'plugin.json'), 'utf8')
    );

    expect(manifest.skills).toBe('./skills/');
    expect(skill).toContain('Matching is case-insensitive');
    expect(skill).toContain('`1m install`: call `install_1m`');
    expect(skill).toContain('`1m uninstall`: call `uninstall_1m`');
    expect(skill).toContain('`1m on`: call `toggle_1m_context` with `enable=true`');
    expect(skill).toContain('`1m off`: call `toggle_1m_context` with `enable=false`');
    expect(skill).toContain('`1m state`: call `context_status`');
  });

  it('uses all five exact English commands as starter prompts', () => {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), '.codex-plugin', 'plugin.json'),
        'utf8'
      )
    );

    expect(manifest.interface.defaultPrompt).toEqual([
      '1M install',
      '1M uninstall',
      '1M on',
      '1M off',
      '1M state',
    ]);
  });

  it('keeps MCP tool descriptions in one source file', () => {
    const serverSource = fs.readFileSync(path.join(process.cwd(), 'src', 'mcp-server.ts'), 'utf8');
    expect(serverSource).toContain('tools: MCP_TOOLS');
    expect(serverSource).not.toContain('TOOL_DESCRIPTIONS');
  });

  it('exposes profile as an explicit opt-in while global remains the default', () => {
    const on = program.commands.find((command) => command.name() === 'on');
    const off = program.commands.find((command) => command.name() === 'off');
    expect(on?.options.map((option) => option.long)).toEqual(expect.arrayContaining(['--profile', '--global']));
    expect(off?.options.map((option) => option.long)).toEqual(expect.arrayContaining(['--profile', '--global']));
    const toggle = MCP_TOOLS.find((tool) => tool.name === 'toggle_1m_context');
    expect((toggle?.inputSchema.properties as any).profile.description).toContain('false or omitted uses global');
  });

  it('normalizes terminal subcommands case-insensitively', () => {
    expect(normalizeCommandCase(['node', '1m', 'ON'])).toEqual(['node', '1m', 'on']);
    expect(normalizeCommandCase(['node', '1m', 'InStAlL'])).toEqual(['node', '1m', 'install']);
    expect(normalizeCommandCase(['node', '1m', '--help'])).toEqual(['node', '1m', '--help']);
  });
});
