import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { applyTomlPatches, CodexConfig, ConfigManager, TomlPatch } from './config-manager';

export const MODEL = 'gpt-5.6-sol';
export const CONTEXT_WINDOW = 1000000;
export const AUTO_COMPACT_LIMIT = 900000;
export const PLUGIN_ID = 'codex-1m@codex-1m';
export const MARKETPLACE_NAME = 'codex-1m';

const MANAGED = {
  model: MODEL,
  model_context_window: CONTEXT_WINDOW,
  model_auto_compact_token_limit: AUTO_COMPACT_LIMIT,
} as const;

interface SnapshotValue {
  existed: boolean;
  value?: string | number;
}

interface InstallState {
  version: 1;
  createdAt: string;
  backupPath?: string;
  original: Record<keyof typeof MANAGED, SnapshotValue>;
  managed: typeof MANAGED;
}

export class ConfigConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigConflictError';
  }
}

export interface InstallResult {
  configPath: string;
  backupPath: string;
  idempotent: boolean;
}

export interface CleanupStatus {
  status: 'removed' | 'skipped';
  detail?: string;
}

export interface UninstallResult {
  backupPath: string | null;
  removed: string[];
  plugin: CleanupStatus;
  marketplace: CleanupStatus;
}

export interface CodexCommandRunner {
  run(args: string[]): { status: number | null; stdout?: string; stderr?: string; error?: Error };
}

function isManaged(config: CodexConfig): boolean {
  return Object.entries(MANAGED).every(([key, value]) => config[key] === value);
}

function hasManagedValue(config: CodexConfig): boolean {
  return Object.entries(MANAGED).some(([key, value]) => config[key] === value);
}

function snapshot(config: CodexConfig, key: keyof typeof MANAGED): SnapshotValue {
  return Object.prototype.hasOwnProperty.call(config, key)
    ? { existed: true, value: config[key] as string | number }
    : { existed: false };
}

function readState(manager: ConfigManager): InstallState | null {
  const statePath = manager.getStatePath();
  if (!fs.existsSync(statePath)) return null;
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8')) as InstallState;
    if (state.version !== 1 || !state.original || !state.managed) throw new Error('unsupported format');
    for (const key of Object.keys(MANAGED) as Array<keyof typeof MANAGED>) {
      if (!state.original[key] || state.managed[key] !== MANAGED[key]) throw new Error('unsupported values');
    }
    return state;
  } catch (error) {
    throw new ConfigConflictError(
      `Cannot safely restore configuration because ${statePath} is invalid: ${error}`
    );
  }
}

function latestBackup(manager: ConfigManager): string {
  const directory = path.dirname(manager.getConfigPath());
  const prefix = `${path.basename(manager.getConfigPath())}.bak.`;
  const backups = fs.readdirSync(directory)
    .filter((name) => name.startsWith(prefix))
    .map((name) => path.join(directory, name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  return backups[0] || '(existing backup path unavailable)';
}

export function installCodex1M(manager: ConfigManager = new ConfigManager()): InstallResult {
  return manager.runExclusive(() => {
    const config = manager.readConfig();
    const existingState = readState(manager);
    if (existingState) {
      if (!isManaged(config)) {
        throw new ConfigConflictError(
          `Conflict: ${manager.getStatePath()} exists but the managed values were changed. ` +
          'No files were modified.'
        );
      }
      return {
        configPath: manager.getConfigPath(),
        backupPath: existingState.backupPath || latestBackup(manager),
        idempotent: true,
      };
    }

    const backupPath = manager.createBackup();
    const state: InstallState = {
      version: 1,
      createdAt: new Date().toISOString(),
      backupPath,
      original: {
        model: snapshot(config, 'model'),
        model_context_window: snapshot(config, 'model_context_window'),
        model_auto_compact_token_limit: snapshot(config, 'model_auto_compact_token_limit'),
      },
      managed: { ...MANAGED },
    };
    manager.writeTextFileAtomic(manager.getStatePath(), `${JSON.stringify(state, null, 2)}\n`);
    try {
      manager.patchConfig([
        { type: 'set', key: 'model', value: MODEL },
        { type: 'set', key: 'model_context_window', value: CONTEXT_WINDOW },
        { type: 'set', key: 'model_auto_compact_token_limit', value: AUTO_COMPACT_LIMIT },
      ], false);
      if (!isManaged(manager.readConfig())) {
        throw new Error(`Verification failed after writing ${manager.getConfigPath()}`);
      }
    } catch (error) {
      manager.removeFile(manager.getStatePath());
      throw error;
    }
    return { configPath: manager.getConfigPath(), backupPath, idempotent: false };
  });
}

function createRunner(): CodexCommandRunner | null {
  const binary = process.env.CODEX_BIN || findCodexBinary();
  if (!binary) return null;
  return {
    run(args: string[]) {
      const result = spawnSync(binary, args, { encoding: 'utf8', env: process.env });
      return {
        status: result.status,
        stdout: result.stdout || undefined,
        stderr: result.stderr || undefined,
        error: result.error,
      };
    },
  };
}

function findCodexBinary(): string | null {
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['codex'], {
    encoding: 'utf8',
  });
  if (probe.status === 0) return probe.stdout.trim().split(/\r?\n/)[0] || null;
  const appBinary = '/Applications/ChatGPT.app/Contents/Resources/codex';
  return process.platform === 'darwin' && fs.existsSync(appBinary) ? appBinary : null;
}

function runRemoval(runner: CodexCommandRunner | null, args: string[]): CleanupStatus {
  if (!runner) return { status: 'skipped', detail: 'Codex CLI not found' };
  const result = runner.run(args);
  if (result.status === 0) return { status: 'removed' };
  const detail = result.error?.message || result.stderr?.trim() || result.stdout?.trim() ||
    `command exited with status ${result.status}`;
  return { status: 'skipped', detail };
}

function promptFiles(codexHome: string): string[] {
  const promptDirectory = path.join(codexHome, 'prompts');
  if (!fs.existsSync(promptDirectory)) return [];
  return fs.readdirSync(promptDirectory)
    .filter((name) => /^1m.*\.md$/i.test(name))
    .map((name) => path.join(promptDirectory, name));
}

export function uninstallCodex1M(options: {
  manager?: ConfigManager;
  codexHome?: string;
  runner?: CodexCommandRunner | null;
} = {}): UninstallResult {
  const codexHome = options.codexHome || process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const manager = options.manager || new ConfigManager(path.join(codexHome, 'config.toml'));

  const local = manager.runExclusive(() => {
    const config = manager.readConfig();
    let state: InstallState | null;
    try {
      state = readState(manager);
    } catch (error) {
      if (hasManagedValue(config)) throw error;
      state = null;
    }
    if (!state && hasManagedValue(config)) {
      throw new ConfigConflictError(
        `Conflict: codex-1M values are present but ${manager.getStatePath()} is missing. ` +
        'Refusing to remove values without the original key snapshot.'
      );
    }
    if (state) {
      const conflicts = Object.entries(MANAGED)
        .filter(([key, value]) => config[key] !== value)
        .map(([key]) => key);
      if (conflicts.length > 0) {
        throw new ConfigConflictError(
          `Conflict: user-modified setting(s): ${conflicts.join(', ')}. ` +
          'Nothing was removed; restore or review these values manually.'
        );
      }
    }

    const patches: TomlPatch[] = [];
    const removed: string[] = [];
    if (state) {
      for (const key of Object.keys(MANAGED) as Array<keyof typeof MANAGED>) {
        const original = state.original[key];
        patches.push(original.existed
          ? { type: 'set', key, value: original.value as string | number }
          : { type: 'remove', key });
      }
      removed.push('managed top-level values');
    }
    if (config.profiles?.['1m']) {
      patches.push({ type: 'remove-table', path: ['profiles', '1m'] });
      removed.push('profiles.1m');
    }
    if (config.mcp_servers?.['codex-1m']) {
      patches.push({ type: 'remove-table', path: ['mcp_servers', 'codex-1m'] });
      removed.push('mcp_servers.codex-1m');
    }

    const originalText = fs.readFileSync(manager.getConfigPath(), 'utf8');
    const updatedText = applyTomlPatches(originalText, patches);
    const backupPath = updatedText === originalText ? null : manager.createBackup();
    if (updatedText !== originalText) manager.patchConfig(patches, false);

    const legacyFiles = [
      manager.getProfilePath(),
      manager.getPristinePath(),
      manager.getStatePath(),
      ...promptFiles(codexHome),
    ];
    for (const filePath of legacyFiles) {
      if (manager.removeFile(filePath)) removed.push(path.relative(codexHome, filePath));
    }
    return { backupPath, removed };
  });

  const runner = options.runner === undefined ? createRunner() : options.runner;
  const plugin = runRemoval(runner, ['plugin', 'remove', PLUGIN_ID]);
  const marketplace = runRemoval(runner, ['plugin', 'marketplace', 'remove', MARKETPLACE_NAME]);
  return { ...local, plugin, marketplace };
}

export function formatInstallResult(result: InstallResult): string {
  return [
    '✓ Codex 1M context enabled',
    '✓ Original config backed up',
    `Backup: ${result.backupPath}`,
    `Config: ${result.configPath}`,
    '',
    'Restart Codex to apply.',
  ].join('\n');
}

function formatCleanup(label: string, result: CleanupStatus): string {
  return result.status === 'removed'
    ? `${label}: removed`
    : `${label}: skipped (${result.detail})`;
}

export function formatUninstallResult(result: UninstallResult): string {
  return [
    '✓ Codex 1M context uninstalled',
    '✓ Legacy codex-1M files cleaned',
    `Backup: ${result.backupPath || 'not needed'}`,
    `Removed: ${result.removed.length > 0 ? result.removed.join(', ') : 'none'}`,
    formatCleanup('Plugin', result.plugin),
    formatCleanup('Marketplace', result.marketplace),
    '',
    'Restart Codex to apply.',
  ].join('\n');
}
