#!/usr/bin/env node

import { Command } from 'commander';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import { ConfigManager } from './config-manager';
import { ConfigModifier } from './config-modifier';

export const program = new Command();
const GITHUB_MARKETPLACE = 'MaxForAI/codex-1M';
const MARKETPLACE_NAME = 'codex-1m';

function resolveCodexBinary(): string {
  if (process.env.CODEX_BIN) {
    return process.env.CODEX_BIN;
  }

  const pathProbe = spawnSync(
    process.platform === 'win32' ? 'where' : 'which',
    ['codex'],
    { encoding: 'utf8' }
  );
  const fromPath = pathProbe.stdout?.trim().split(/\r?\n/)[0];
  if (pathProbe.status === 0 && fromPath) {
    return fromPath;
  }

  const macAppBinary = '/Applications/ChatGPT.app/Contents/Resources/codex';
  if (process.platform === 'darwin' && fs.existsSync(macAppBinary)) {
    return macAppBinary;
  }

  throw new Error(
    'Codex CLI was not found. Install Codex or set CODEX_BIN to the codex executable.'
  );
}

function runCodex(codexBinary: string, args: string[]): void {
  const result = spawnSync(codexBinary, args, {
    encoding: 'utf8',
    env: process.env,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`codex ${args.join(' ')} exited with status ${result.status}`);
  }
}

program
  .name('codex-1m')
  .description('Control Codex\'s 1M-token context with on, off, or state')
  .version('1.2.0');

program
  .command('on')
  .description('Enable 1M token context window')
  .option('--global', 'Modify top-level configuration instead of creating a profile')
  .action(async (options) => {
    try {
      const configManager = new ConfigManager();
      const modifier = new ConfigModifier(configManager);

      const result = modifier.enable1MContext(options.global);
      console.log(result);

      // Register MCP server
      modifier.registerMCPServer();
      console.log('MCP server registered.');

      console.log(`\nBackup created at: ${configManager.getBackupPath()}`);
    } catch (error) {
      console.error('Error enabling 1M context:', error);
      process.exit(1);
    }
  });

program
  .command('off')
  .description('Disable 1M token context window')
  .option('--global', 'Remove top-level configuration instead of profile')
  .action(async (options) => {
    try {
      const configManager = new ConfigManager();
      const modifier = new ConfigModifier(configManager);

      const result = modifier.disable1MContext(options.global);
      console.log(result);

      console.log(`\nBackup created at: ${configManager.getBackupPath()}`);
    } catch (error) {
      console.error('Error disabling 1M context:', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .alias('state')
  .description('Show current 1M context state (status remains supported)')
  .action(async () => {
    try {
      const configManager = new ConfigManager();
      const modifier = new ConfigModifier(configManager);

      const status = modifier.getStatus();

      console.log('Codex 1M Context State:');
      console.log('=======================');
      console.log(`Model: ${status.model}`);
      console.log(`Context Window: ${status.model_context_window.toLocaleString()} tokens`);
      console.log(`Auto Compact Limit: ${status.model_auto_compact_token_limit.toLocaleString()} tokens`);
      console.log(`1M Enabled: ${status.enabled ? 'Yes (global)' : 'No'}`);

      if (!status.enabled) {
        console.log('\nTip: Use "codex --profile 1m" if you created a 1M profile');
      }
    } catch (error) {
      console.error('Error getting state:', error);
      process.exit(1);
    }
  });

program
  .command('install')
  .description('Install the codex-1m plugin from its GitHub marketplace')
  .action(async () => {
    try {
      const codexBinary = resolveCodexBinary();
      const source = process.env.CODEX_1M_MARKETPLACE_SOURCE || GITHUB_MARKETPLACE;

      console.log(`Adding Codex plugin marketplace: ${source}`);
      runCodex(codexBinary, ['plugin', 'marketplace', 'add', source, '--json']);

      console.log(`Installing ${MARKETPLACE_NAME}@${MARKETPLACE_NAME}`);
      runCodex(codexBinary, [
        'plugin',
        'add',
        `${MARKETPLACE_NAME}@${MARKETPLACE_NAME}`,
        '--json',
      ]);

      console.log('\nInstalled. Start a new Codex conversation, then use: 1M on, 1M off, or 1M state.');
    } catch (error) {
      console.error('Error during installation:', error);
      process.exit(1);
    }
  });

if (require.main === module) {
  // Default to 'on' if no command specified
  if (process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === 'on')) {
    program.parse(['node', 'codex-1m', 'on']);
  } else {
    program.parse();
  }
}
