import * as fs from 'fs';
import * as path from 'path';
import { program } from './cli';
import { MCP_TOOLS } from './mcp-tools';

describe('short command routing', () => {
  it('advertises the exact chat commands in MCP tool descriptions', () => {
    const install = MCP_TOOLS.find((tool) => tool.name === 'install_1m');
    const update = MCP_TOOLS.find((tool) => tool.name === 'update_1m');
    const doctor = MCP_TOOLS.find((tool) => tool.name === 'doctor_1m');
    const uninstall = MCP_TOOLS.find((tool) => tool.name === 'uninstall_1m');
    const toggle = MCP_TOOLS.find((tool) => tool.name === 'toggle_1m_context');
    const state = MCP_TOOLS.find((tool) => tool.name === 'context_status');

    expect(install?.description).toContain('1m install');
    expect(install?.description).toContain('case-insensitive');
    expect(update?.description).toContain('1m update');
    expect(update?.description).toContain('case-insensitive');
    expect(doctor?.description).toContain('1m doctor');
    expect(doctor?.description).toContain('case-insensitive');
    expect(uninstall?.description).toContain('1m uninstall');
    expect(uninstall?.description).toContain('case-insensitive');
    expect(toggle?.description).toContain('1M on');
    expect(toggle?.description).toContain('1M off');
    expect(toggle?.description).toContain('case-insensitive');
    expect(state?.description).toContain('1M state');
    expect(state?.description).toContain('case-insensitive');
  });

  it('uses state as the canonical command and keeps status as a legacy alias', () => {
    const state = program.commands.find((command) => command.name() === 'state');

    expect(state).toBeDefined();
    expect(state?.aliases()).toContain('status');
  });

  it('declares both executable names and all seven unified subcommands', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
    );

    expect(packageJson.bin['1m']).toBe('./dist/cli.js');
    expect(packageJson.bin['codex-1m']).toBe('./dist/cli.js');
    expect(program.name()).toBe('1m');
    expect(program.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['install', 'update', 'doctor', 'uninstall', 'on', 'off', 'state'])
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
    expect(readme).toContain('| `1m update` | `update_1m` |');
    expect(readme).toContain('| `1m doctor` | `doctor_1m` |');
    expect(readme).toContain('| `1m uninstall` | `uninstall_1m` |');
    expect(readme).toContain('| `1m on` | `toggle_1m_context(enable=true)` |');
    expect(readme).toContain('| `1m off` | `toggle_1m_context(enable=false)` |');
    expect(readme).toContain('| `1m state` | `context_status` |');
    expect(readme).toContain('there is no tool left to\nreceive it');
    expect(readme).toContain('Do not use `npx 1m`');
    expect(readme).toContain('$CODEX_HOME/1m.config.toml');
    expect(readme).toContain('codex --profile 1m');
    expect(readme).toContain('codex-1m-state.json');
    expect(readme).toContain('$CODEX_HOME/.codex-1m.lock');
    expect(readme).toContain('Global configuration: disabled');
    expect(readme).toContain('1M profile file: available');
    expect(readme).toContain('Current conversation: unknown');
    expect(readme).toContain('1M Configured: Yes');
    expect(readme).not.toContain('By default, `1m on` creates the opt-in `[profiles.1m]`');
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
    expect(skill).toContain('`1m update`: call `update_1m`');
    expect(skill).toContain('`1m doctor`: call `doctor_1m`');
    expect(skill).toContain('`1m uninstall`: call `uninstall_1m`');
    expect(skill).toContain('`1m on`: call `toggle_1m_context` with `enable=true`');
    expect(skill).toContain('`1m off`: call `toggle_1m_context` with `enable=false`');
    expect(skill).toContain('`1m state`: call `context_status`');
  });

  it('uses all seven exact English commands as starter prompts', () => {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), '.codex-plugin', 'plugin.json'),
        'utf8'
      )
    );

    expect(manifest.interface.defaultPrompt).toEqual([
      '1M install',
      '1M update',
      '1M doctor',
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
});
