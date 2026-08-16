import * as fs from 'fs';
import * as path from 'path';
import { program } from './cli';
import { MCP_TOOLS } from './mcp-tools';

describe('short command routing', () => {
  it('advertises the exact chat commands in MCP tool descriptions', () => {
    const toggle = MCP_TOOLS.find((tool) => tool.name === 'toggle_1m_context');
    const state = MCP_TOOLS.find((tool) => tool.name === 'context_status');

    expect(toggle?.description).toContain('1M on');
    expect(toggle?.description).toContain('1M off');
    expect(toggle?.description).toContain('case-insensitive');
    expect(state?.description).toContain('1M state');
    expect(state?.description).toContain('case-insensitive');
  });

  it('keeps status and adds state as its CLI alias', () => {
    const status = program.commands.find((command) => command.name() === 'status');

    expect(status).toBeDefined();
    expect(status?.aliases()).toContain('state');
  });

  it('documents all case-insensitive chat mappings in the installed prompt', () => {
    const promptPaths = ['1m.md', '1m-toggle.md'];

    for (const promptPath of promptPaths) {
      const prompt = fs.readFileSync(
        path.join(process.cwd(), 'prompts', promptPath),
        'utf8'
      );

      expect(prompt).toContain('Matching is\ncase-insensitive');
      expect(prompt).toContain('`1M on`: call `toggle_1m_context` with `enable=true`');
      expect(prompt).toContain('`1M off`: call `toggle_1m_context` with `enable=false`');
      expect(prompt).toContain('`1M state`: call `context_status`');
      expect(prompt).not.toContain('ACTION=');
      expect(prompt).not.toMatch(/`1M status`|ACTION=status/);
    }
  });

  it('uses only the three exact English commands as starter prompts', () => {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), '.codex-plugin', 'plugin.json'),
        'utf8'
      )
    );

    expect(manifest.interface.defaultPrompt).toEqual([
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
  });
});
