import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigManager } from './config-manager';
import { ConfigModifier, UninstallConfigResult } from './config-modifier';

export const MANAGED_PROMPT_FILES = ['1m.md', '1m-toggle.md'] as const;

export interface UninstallLocalResult {
  config: UninstallConfigResult;
  backupPath: string | null;
  removedPrompts: string[];
  preservedPrompts: string[];
}

export function getCodexHome(): string {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

function isCodex1MPrompt(content: string): boolean {
  const hasKnownHeading =
    content.includes('# Codex 1M Commands') ||
    content.includes('# 1M Context Toggle');
  const hasManagedInstructions =
    content.includes('toggle_1m_context') ||
    content.includes('MCP tools');
  return hasKnownHeading && hasManagedInstructions;
}

export function removeManagedPrompts(codexHome: string = getCodexHome()): {
  removed: string[];
  preserved: string[];
} {
  const promptDir = path.join(codexHome, 'prompts');
  const removed: string[] = [];
  const preserved: string[] = [];

  for (const fileName of MANAGED_PROMPT_FILES) {
    const promptPath = path.join(promptDir, fileName);
    if (!fs.existsSync(promptPath)) continue;

    const content = fs.readFileSync(promptPath, 'utf8');
    if (isCodex1MPrompt(content)) {
      fs.unlinkSync(promptPath);
      removed.push(promptPath);
    } else {
      preserved.push(promptPath);
    }
  }

  return { removed, preserved };
}

export function uninstallLocalArtifacts(
  configManager: ConfigManager = new ConfigManager(),
  codexHome: string = getCodexHome()
): UninstallLocalResult {
  const modifier = new ConfigModifier(configManager);
  const needsBackup = modifier.hasUninstallArtifacts();
  const backupPath = needsBackup ? configManager.createBackup() : null;
  const config = modifier.uninstallConfiguration();
  const prompts = removeManagedPrompts(codexHome);

  return {
    config,
    backupPath,
    removedPrompts: prompts.removed,
    preservedPrompts: prompts.preserved,
  };
}
