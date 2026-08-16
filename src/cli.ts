#!/usr/bin/env node

import { Command } from 'commander';
import { ConfigManager } from './config-manager';
import { ConfigModifier } from './config-modifier';

const program = new Command();

program
  .name('codex-1m')
  .description('One command to unlock Codex\'s 1M-token context')
  .version('1.0.0');

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
  .description('Show current 1M context status')
  .action(async () => {
    try {
      const configManager = new ConfigManager();
      const modifier = new ConfigModifier(configManager);

      const status = modifier.getStatus();

      console.log('Codex 1M Context Status:');
      console.log('========================');
      console.log(`Model: ${status.model}`);
      console.log(`Context Window: ${status.model_context_window.toLocaleString()} tokens`);
      console.log(`Auto Compact Limit: ${status.model_auto_compact_token_limit.toLocaleString()} tokens`);
      console.log(`1M Enabled: ${status.enabled ? 'Yes (global)' : 'No'}`);

      if (!status.enabled) {
        console.log('\nTip: Use "codex --profile 1m" if you created a 1M profile');
      }
    } catch (error) {
      console.error('Error getting status:', error);
      process.exit(1);
    }
  });

program
  .command('install')
  .description('Install codex-1m (register MCP server and create prompt)')
  .action(async () => {
    try {
      const configManager = new ConfigManager();
      const modifier = new ConfigModifier(configManager);

      // Register MCP server
      modifier.registerMCPServer();
      console.log('MCP server registered.');

      // Create prompt file
      const promptDir = require('path').join(require('os').homedir(), '.codex', 'prompts');
      const fs = require('fs');

      if (!fs.existsSync(promptDir)) {
        fs.mkdirSync(promptDir, { recursive: true });
      }

      const promptPath = require('path').join(promptDir, '1m.md');
      const promptContent = `# 1M Context Toggle

You can enable or disable the 1M token context window using the MCP tools:

- Ask me to "enable 1M context" to toggle it on
- Ask me to "disable 1M context" to toggle it off
- Ask me to "check context status" to see current settings

Note: Configuration changes require starting a new Codex session to take effect.
`;

      fs.writeFileSync(promptPath, promptContent, 'utf-8');
      console.log(`Prompt file created at: ${promptPath}`);

      console.log('\nInstallation complete! You can now use /1m in Codex conversations.');
    } catch (error) {
      console.error('Error during installation:', error);
      process.exit(1);
    }
  });

// Default to 'on' if no command specified
if (process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === 'on')) {
  program.parse(['node', 'codex-1m', 'on']);
} else {
  program.parse();
}
