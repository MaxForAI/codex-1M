#!/usr/bin/env node

import { Command } from 'commander';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from './config-manager';
import { ConfigModifier } from './config-modifier';
import { uninstallLocalArtifacts } from './uninstaller';

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

function runCodexJson(codexBinary: string, args: string[]): any {
  const result = spawnSync(codexBinary, args, {
    encoding: 'utf8',
    env: process.env,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim();
    throw new Error(
      `codex ${args.join(' ')} exited with status ${result.status}${detail ? `: ${detail}` : ''}`
    );
  }
  return JSON.parse(result.stdout || '{}');
}

interface PluginRemovalResult {
  plugin: 'removed' | 'not installed' | 'manual action required';
  marketplace: 'removed' | 'not configured' | 'manual action required';
  detail?: string;
}

function isManagedMarketplace(marketplace: any, pluginWasInstalled: boolean): boolean {
  if (marketplace?.name !== MARKETPLACE_NAME) return false;
  if (pluginWasInstalled) return true;

  const sourceDescription = JSON.stringify(marketplace.marketplaceSource || {}).toLowerCase();
  if (sourceDescription.includes('maxforai/codex-1m')) return true;

  if (typeof marketplace.root === 'string') {
    const manifestPath = path.join(marketplace.root, '.codex-plugin', 'plugin.json');
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      return (
        manifest.name === MARKETPLACE_NAME &&
        typeof manifest.repository === 'string' &&
        manifest.repository.toLowerCase().includes('maxforai/codex-1m')
      );
    } catch {
      return false;
    }
  }

  return false;
}

function removeCodexPlugin(): PluginRemovalResult {
  let codexBinary: string;
  try {
    codexBinary = resolveCodexBinary();
  } catch (error) {
    return {
      plugin: 'manual action required',
      marketplace: 'manual action required',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    const pluginList = runCodexJson(codexBinary, ['plugin', 'list', '--json']);
    const installed = Array.isArray(pluginList.installed)
      ? pluginList.installed.some(
          (plugin: any) => plugin.pluginId === `${MARKETPLACE_NAME}@${MARKETPLACE_NAME}`
        )
      : false;

    let plugin: PluginRemovalResult['plugin'] = 'not installed';
    if (installed) {
      runCodexJson(codexBinary, [
        'plugin',
        'remove',
        `${MARKETPLACE_NAME}@${MARKETPLACE_NAME}`,
        '--json',
      ]);
      plugin = 'removed';
    }

    const marketplaceList = runCodexJson(codexBinary, [
      'plugin',
      'marketplace',
      'list',
      '--json',
    ]);
    const namedMarketplace = Array.isArray(marketplaceList.marketplaces)
      ? marketplaceList.marketplaces.find(
          (marketplace: any) => marketplace.name === MARKETPLACE_NAME
        )
      : undefined;
    const configured = isManagedMarketplace(namedMarketplace, installed);

    let marketplace: PluginRemovalResult['marketplace'] = 'not configured';
    if (configured) {
      runCodexJson(codexBinary, [
        'plugin',
        'marketplace',
        'remove',
        MARKETPLACE_NAME,
        '--json',
      ]);
      marketplace = 'removed';
    }

    if (namedMarketplace && !configured) {
      return {
        plugin,
        marketplace: 'manual action required',
        detail:
          'A marketplace named codex-1m remains because its source could not be verified as MaxForAI/codex-1M.',
      };
    }

    return { plugin, marketplace };
  } catch (error) {
    return {
      plugin: 'manual action required',
      marketplace: 'manual action required',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

program
  .name('1m')
  .description('Control Codex\'s 1M-token context with on, off, or state')
  .version('1.4.0');

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
  .command('state')
  .alias('status')
  .description('Show current 1M context state (status is a legacy alias)')
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

      console.log('\nInstalled marketplace, plugin, and bundled MCP server.');
      console.log('Start a new Codex session, then use: 1m on, 1m off, or 1m state.');
    } catch (error) {
      console.error('Error during installation:', error);
      process.exit(1);
    }
  });

program
  .command('uninstall')
  .description('Safely remove codex-1m configuration, prompts, plugin, and marketplace')
  .action(async () => {
    try {
      const local = uninstallLocalArtifacts();
      const plugin = removeCodexPlugin();

      console.log('1m uninstall complete');
      console.log('=====================');
      console.log(
        `Configuration: ${
          local.config.changed
            ? `removed ${local.config.removed.join(', ')}`
            : 'no managed settings found'
        }`
      );
      console.log(`Backup: ${local.backupPath || 'not needed (config was unchanged)'}`);
      console.log(
        `Prompts: ${
          local.removedPrompts.length > 0
            ? `removed ${local.removedPrompts.join(', ')}`
            : 'no managed prompt files found'
        }`
      );
      if (local.preservedPrompts.length > 0) {
        console.log(
          `Prompts preserved because their content is not recognized as codex-1m: ${local.preservedPrompts.join(', ')}`
        );
      }
      console.log(`Plugin ${MARKETPLACE_NAME}@${MARKETPLACE_NAME}: ${plugin.plugin}`);
      console.log(`Marketplace ${MARKETPLACE_NAME}: ${plugin.marketplace}`);
      if (plugin.detail) {
        console.log(`Plugin detail: ${plugin.detail}`);
        console.log(
          'Remaining action: open Codex, enter /plugins, open codex-1m, and choose Uninstall plugin.'
        );
      }
      console.log('Unrelated Codex configuration and prompt files were preserved.');
      console.log('You can reinstall at any time with: 1m install');
    } catch (error) {
      console.error('Error during uninstall:', error);
      process.exit(1);
    }
  });

if (require.main === module) {
  // Default to 'on' if no command specified
  if (process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === 'on')) {
    program.parse(['node', '1m', 'on']);
  } else {
    program.parse();
  }
}
