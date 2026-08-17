import * as fs from 'fs';
import * as path from 'path';
import { program } from './cli';
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

  it('uses state as the canonical command and keeps status as a legacy alias', () => {
    const state = program.commands.find((command) => command.name() === 'state');

    expect(state).toBeDefined();
    expect(state?.aliases()).toContain('status');
  });

  it('declares both executable names and all five unified subcommands', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
    );

    expect(packageJson.bin['1m']).toBe('./dist/cli.js');
    expect(packageJson.bin['codex-1m']).toBe('./dist/cli.js');
    expect(program.name()).toBe('1m');
    expect(program.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['install', 'uninstall', 'on', 'off', 'state'])
    );
  });

  it('documents one bootstrap and the unified command table without legacy npx commands', () => {
    const readme = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf8');

    expect(readme).toContain('## In Codex conversation');
    expect(readme).toContain('npm i -g github:MaxForAI/codex-1M');
    expect(readme).toContain('| `1m install` | `install_1m` |');
    expect(readme).toContain('| `1m uninstall` | `uninstall_1m` |');
    expect(readme).toContain('| `1m on` | `toggle_1m_context(enable=true)` |');
    expect(readme).toContain('| `1m off` | `toggle_1m_context(enable=false)` |');
    expect(readme).toContain('| `1m state` | `context_status` |');
    expect(readme).toContain('there is no tool left to\nreceive it');
    expect(readme).not.toMatch(/npx (?:codex-1m|github:MaxForAI\/codex-1M)/);
  });

  it('documents all case-insensitive chat mappings in the installed prompt', () => {
    const promptPaths = ['1m.md', '1m-toggle.md'];

    for (const promptPath of promptPaths) {
      const prompt = fs.readFileSync(
        path.join(process.cwd(), 'prompts', promptPath),
        'utf8'
      );

      expect(prompt).toContain('Matching is\ncase-insensitive');
      expect(prompt).toContain('`1M install`: call `install_1m`');
      expect(prompt).toContain('`1M uninstall`: call `uninstall_1m`');
      expect(prompt).toContain('`1M on`: call `toggle_1m_context` with `enable=true`');
      expect(prompt).toContain('`1M off`: call `toggle_1m_context` with `enable=false`');
      expect(prompt).toContain('`1M state`: call `context_status`');
      expect(prompt).not.toContain('ACTION=');
      expect(prompt).not.toMatch(/`1M status`|ACTION=status/);
    }
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

  it('declares the trigger phrases at the MCP server source boundary', () => {
    const serverSource = fs.readFileSync(
      path.join(process.cwd(), 'src', 'mcp-server.ts'),
      'utf8'
    );

    expect(serverSource).toContain("user types '1M on'");
    expect(serverSource).toContain("user types '1M off'");
    expect(serverSource).toContain("user types '1M state'");
    expect(serverSource).toContain("user types '1m install'");
    expect(serverSource).toContain("user types '1m uninstall'");
  });
});
