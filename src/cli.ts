#!/usr/bin/env node

import { Command } from 'commander';
import { ConfigManager } from './config-manager';
import { ConfigModifier, formatConfigStatus } from './config-modifier';
import {
  formatInstallResult,
  formatUninstallResult,
  installCodex1M,
  uninstallCodex1M,
} from './integration';

export const program = new Command();

program
  .name('1m')
  .description('Install, uninstall, and control Codex 1M support')
  .version('1.6.0');

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

      if (configManager.getBackupPath()) {
        console.log(`\nBackup created at: ${configManager.getBackupPath()}`);
      }
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

      if (configManager.getBackupPath()) {
        console.log(`\nBackup created at: ${configManager.getBackupPath()}`);
      }
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

      console.log('Codex 1M Configuration:');
      console.log('=======================');
      console.log(formatConfigStatus(status));
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
      console.log(formatInstallResult(installCodex1M()));
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
      console.log(formatUninstallResult(uninstallCodex1M()));
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
