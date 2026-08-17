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
import { PACKAGE_VERSION } from './version';

export const program = new Command();
const COMMANDS = new Set(['install', 'uninstall', 'on', 'off', 'state']);

export function normalizeCommandCase(argv: string[]): string[] {
  const normalized = [...argv];
  if (normalized.length > 2) {
    const candidate = normalized[2].toLowerCase();
    if (COMMANDS.has(candidate)) normalized[2] = candidate;
  }
  return normalized;
}

program
  .name('1m')
  .description('Install, uninstall, and control Codex long-context support')
  .version(PACKAGE_VERSION);

program
  .command('on')
  .description('Configure long-context settings globally for new Codex conversations')
  .option('--profile', 'Write only 1m.config.toml for codex --profile 1m')
  .option('--global', 'Compatibility alias for the default global behavior')
  .action(async (options) => {
    try {
      if (options.profile && options.global) throw new Error('Choose either --profile or --global, not both.');
      const configManager = new ConfigManager();
      const modifier = new ConfigModifier(configManager);

      const result = modifier.enable1MContext(!options.profile);
      console.log(result);
    } catch (error) {
      console.error('Error configuring 1M settings:', error);
      process.exit(1);
    }
  });

program
  .command('off')
  .description('Restore managed global settings for new Codex conversations')
  .option('--profile', 'Remove only the managed 1m.config.toml profile')
  .option('--global', 'Compatibility alias for the default global behavior')
  .action(async (options) => {
    try {
      if (options.profile && options.global) throw new Error('Choose either --profile or --global, not both.');
      const configManager = new ConfigManager();
      const modifier = new ConfigModifier(configManager);

      const result = modifier.disable1MContext(!options.profile);
      console.log(result);
    } catch (error) {
      console.error('Error removing 1M settings:', error);
      process.exit(1);
    }
  });

program
  .command('state')
  .description('Show current long-context configuration state')
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
  .description('Safely remove codex-1m configuration, plugin, and marketplace')
  .action(async () => {
    try {
      console.log(formatUninstallResult(uninstallCodex1M()));
    } catch (error) {
      console.error('Error during uninstall:', error);
      process.exit(1);
    }
  });

if (require.main === module) {
  const argv = normalizeCommandCase(process.argv);
  // Default to 'on' if no command specified
  if (argv.length === 2) {
    program.parse(['node', '1m', 'on']);
  } else {
    program.parse(argv);
  }
}
