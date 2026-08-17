import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from './config-manager';
import {
  uninstallLocalArtifacts,
  UninstallLocalResult,
} from './uninstaller';

export const GITHUB_MARKETPLACE = 'MaxForAI/codex-1M';
export const MARKETPLACE_NAME = 'codex-1m';
export const PLUGIN_ID = `${MARKETPLACE_NAME}@${MARKETPLACE_NAME}`;

export interface CodexRunner {
  run(args: string[]): unknown;
  runText(args: string[]): string;
}

export interface InstallResult {
  marketplace: 'added' | 'upgraded';
  plugin: 'installed' | 'reinstalled';
  installedVersion: string;
  integration: 'provided by plugin manifest';
  pristine: 'created' | 'preserved';
  pristinePath: string;
}

export interface PluginRemovalResult {
  plugin: 'removed' | 'not installed' | 'manual action required';
  marketplace: 'removed' | 'not configured' | 'manual action required';
  detail?: string;
}

export interface UninstallResult {
  local: UninstallLocalResult;
  plugin: PluginRemovalResult;
}

export function resolveCodexBinary(): string {
  if (process.env.CODEX_BIN) return process.env.CODEX_BIN;

  const pathProbe = spawnSync(
    process.platform === 'win32' ? 'where' : 'which',
    ['codex'],
    { encoding: 'utf8' }
  );
  const fromPath = pathProbe.stdout?.trim().split(/\r?\n/)[0];
  if (pathProbe.status === 0 && fromPath) return fromPath;

  const macAppBinary = '/Applications/ChatGPT.app/Contents/Resources/codex';
  if (process.platform === 'darwin' && fs.existsSync(macAppBinary)) {
    return macAppBinary;
  }

  throw new Error(
    'Codex CLI was not found. Install Codex or set CODEX_BIN to the codex executable.'
  );
}

export function createCodexRunner(codexBinary: string = resolveCodexBinary()): CodexRunner {
  return {
    run(args: string[]): unknown {
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
    },
    runText(args: string[]): string {
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
      return result.stdout.trim();
    },
  };
}

export function isPluginInstalled(pluginList: any): boolean {
  return Array.isArray(pluginList?.installed) &&
    pluginList.installed.some((plugin: any) => plugin.pluginId === PLUGIN_ID);
}

export function findMarketplace(marketplaceList: any): any {
  return Array.isArray(marketplaceList?.marketplaces)
    ? marketplaceList.marketplaces.find((marketplace: any) => marketplace.name === MARKETPLACE_NAME)
    : undefined;
}

export function isManagedMarketplace(marketplace: any, pluginWasInstalled: boolean): boolean {
  if (marketplace?.name !== MARKETPLACE_NAME) return false;
  if (pluginWasInstalled) return true;

  const sourceDescription = JSON.stringify(marketplace.marketplaceSource || {}).toLowerCase();
  if (sourceDescription.includes('maxforai/codex-1m')) return true;

  if (typeof marketplace.root === 'string') {
    const manifestPath = path.join(marketplace.root, '.codex-plugin', 'plugin.json');
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      return manifest.name === MARKETPLACE_NAME &&
        typeof manifest.repository === 'string' &&
        manifest.repository.toLowerCase().includes('maxforai/codex-1m');
    } catch {
      return false;
    }
  }

  return false;
}

export function installCodex1M(options: {
  runner?: CodexRunner;
  configManager?: ConfigManager;
} = {}): InstallResult {
  const runner = options.runner || createCodexRunner();
  const configManager = options.configManager || new ConfigManager();
  const pristine = configManager.ensurePristineSnapshot();
  const source = process.env.CODEX_1M_MARKETPLACE_SOURCE || GITHUB_MARKETPLACE;

  const pluginList = runner.run(['plugin', 'list', '--json']);
  const installed = isPluginInstalled(pluginList);
  const marketplaceList = runner.run(['plugin', 'marketplace', 'list', '--json']);
  const namedMarketplace = findMarketplace(marketplaceList);
  if (namedMarketplace && !isManagedMarketplace(namedMarketplace, installed)) {
    throw new Error(
      'A marketplace named codex-1m already exists, but its source is not MaxForAI/codex-1M. Remove or rename it before installing.'
    );
  }
  let marketplace: InstallResult['marketplace'];
  if (!namedMarketplace) {
    runner.run(['plugin', 'marketplace', 'add', source, '--json']);
    marketplace = 'added';
  } else {
    runner.run(['plugin', 'marketplace', 'upgrade', MARKETPLACE_NAME, '--json']);
    marketplace = 'upgraded';
  }

  if (installed) runner.run(['plugin', 'remove', PLUGIN_ID, '--json']);
  runner.run(['plugin', 'add', PLUGIN_ID, '--json']);
  const refreshed = runner.run(['plugin', 'list', '--json']);

  return {
    marketplace,
    plugin: installed ? 'reinstalled' : 'installed',
    installedVersion: installedPluginVersion(refreshed),
    integration: 'provided by plugin manifest',
    pristine: pristine.created ? 'created' : 'preserved',
    pristinePath: pristine.path,
  };
}

function installedPluginVersion(pluginList: any): string {
  const plugin = Array.isArray(pluginList?.installed)
    ? pluginList.installed.find((entry: any) => entry.pluginId === PLUGIN_ID)
    : undefined;
  return typeof plugin?.version === 'string' ? plugin.version : 'unknown';
}

export function removeCodexPlugin(runner?: CodexRunner): PluginRemovalResult {
  let activeRunner: CodexRunner;
  try {
    activeRunner = runner || createCodexRunner();
  } catch (error) {
    return {
      plugin: 'manual action required',
      marketplace: 'manual action required',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    const pluginList = activeRunner.run(['plugin', 'list', '--json']);
    const installed = isPluginInstalled(pluginList);
    let plugin: PluginRemovalResult['plugin'] = 'not installed';
    if (installed) {
      activeRunner.run(['plugin', 'remove', PLUGIN_ID, '--json']);
      plugin = 'removed';
    }

    const marketplaceList = activeRunner.run(['plugin', 'marketplace', 'list', '--json']);
    const namedMarketplace = findMarketplace(marketplaceList);
    const configured = isManagedMarketplace(namedMarketplace, installed);
    let marketplace: PluginRemovalResult['marketplace'] = 'not configured';
    if (configured) {
      activeRunner.run(['plugin', 'marketplace', 'remove', MARKETPLACE_NAME, '--json']);
      marketplace = 'removed';
    }

    if (namedMarketplace && !configured) {
      return {
        plugin,
        marketplace: 'manual action required',
        detail: 'A marketplace named codex-1m remains because its source could not be verified as MaxForAI/codex-1M.',
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

export function uninstallCodex1M(options: {
  runner?: CodexRunner;
  configManager?: ConfigManager;
  codexHome?: string;
} = {}): UninstallResult {
  const local = uninstallLocalArtifacts(options.configManager, options.codexHome);
  const plugin = removeCodexPlugin(options.runner);
  return { local, plugin };
}

export function formatInstallResult(result: InstallResult): string {
  return [
    '1m install complete',
    '===================',
    `Marketplace ${MARKETPLACE_NAME}: ${result.marketplace}`,
    `Plugin ${PLUGIN_ID}: ${result.plugin}`,
    `Installed plugin version: ${result.installedVersion}`,
    `Pristine config: ${result.pristine} at ${result.pristinePath}`,
    'The pristine file is never overwritten and is only a manual escape hatch.',
    'MCP server and command routing Skill: provided by the installed plugin manifest',
    'Repeat 1m install whenever you want to refresh the marketplace and upgrade to the latest plugin.',
    'Start a new Codex conversation, then use 1m install, 1m uninstall, 1m on, 1m off, or 1m state.',
  ].join('\n');
}

export function formatUninstallResult(result: UninstallResult): string {
  const { local, plugin } = result;
  return [
    '1m uninstall complete',
    '=====================',
    `Configuration: ${local.config.changed ? `removed ${local.config.removed.join(', ')}` : 'no managed settings found'}`,
    `Backup: ${local.backupPath || 'not needed (config was unchanged)'}`,
    `Prompts: ${local.removedPrompts.length > 0 ? `removed ${local.removedPrompts.join(', ')}` : 'no managed prompt files found'}`,
    ...(local.preservedPrompts.length > 0
      ? [`Prompts preserved because their content is not recognized as codex-1m: ${local.preservedPrompts.join(', ')}`]
      : []),
    `Plugin ${PLUGIN_ID}: ${plugin.plugin}`,
    `Marketplace ${MARKETPLACE_NAME}: ${plugin.marketplace}`,
    ...(plugin.detail ? [`Plugin detail: ${plugin.detail}`] : []),
    `Pristine config: ${local.pristineExists ? `preserved at ${local.pristinePath}` : `not found at ${local.pristinePath}`}.`,
    'It is never automatically deleted or restored. To return to the complete pre-install configuration, review and copy that file manually.',
    'Automatic uninstall intentionally restores only codex-1M managed keys so later unrelated user settings are not rolled back.',
    'Uninstall removes this MCP server. To reinstall, use a terminal: codex-1m install (or 1m install if the bootstrap command remains on PATH).',
  ].join('\n');
}
