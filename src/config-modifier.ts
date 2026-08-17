import * as fs from 'fs';
import * as path from 'path';
import * as TOML from '@iarna/toml';
import { applyTomlPatches, CodexConfig, ConfigManager, TomlPatch } from './config-manager';

export interface ConfigStatus {
  configured: boolean;
  globalConfiguration: 'enabled' | 'disabled';
  profileFile: 'available' | 'missing';
  currentConversation: 'unknown';
}

export interface UninstallConfigResult {
  changed: boolean;
  removed: string[];
}

interface SnapshotValue {
  existed: boolean;
  value?: string | number;
}

export interface GlobalConfigState {
  version: 1;
  createdAt: string;
  original: {
    model: SnapshotValue;
    model_context_window: SnapshotValue;
    model_auto_compact_token_limit: SnapshotValue;
  };
  managed: {
    model: string;
    model_context_window: number;
    model_auto_compact_token_limit: number;
  };
}

export const MODEL_1M = 'gpt-5.6-sol';
export const CONTEXT_WINDOW_1M = 1000000;
export const AUTO_COMPACT_LIMIT = 900000;

const MANAGED_GLOBAL = {
  model: MODEL_1M,
  model_context_window: CONTEXT_WINDOW_1M,
  model_auto_compact_token_limit: AUTO_COMPACT_LIMIT,
} as const;

export class ConfigConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigConflictError';
  }
}

function isManagedSignature(config: CodexConfig): boolean {
  return config.model === MODEL_1M &&
    config.model_context_window === CONTEXT_WINDOW_1M &&
    config.model_auto_compact_token_limit === AUTO_COMPACT_LIMIT;
}

function hasAnyManagedValue(config: CodexConfig): boolean {
  return config.model === MODEL_1M ||
    config.model_context_window === CONTEXT_WINDOW_1M ||
    config.model_auto_compact_token_limit === AUTO_COMPACT_LIMIT;
}

function snapshotValue(config: CodexConfig, key: string): SnapshotValue {
  return Object.prototype.hasOwnProperty.call(config, key)
    ? { existed: true, value: config[key] }
    : { existed: false };
}

export function formatConfigStatus(status: ConfigStatus): string {
  return [
    `1M Configured: ${status.configured ? 'Yes' : 'No'}`,
    `Global configuration: ${status.globalConfiguration}`,
    `1M profile file: ${status.profileFile}`,
    'Current conversation: unknown (start a new conversation and use /status to verify)',
  ].join('\n');
}

export class ConfigModifier {
  constructor(private configManager: ConfigManager) {}

  private readState(): GlobalConfigState | null {
    const statePath = this.configManager.getStatePath();
    if (!fs.existsSync(statePath)) return null;
    let state: GlobalConfigState;
    try {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8')) as GlobalConfigState;
    } catch (error) {
      throw new ConfigConflictError(
        `Cannot safely restore global configuration because ${statePath} is invalid: ${error}`
      );
    }
    if (state.version !== 1 || !state.original || !state.managed) {
      throw new ConfigConflictError(
        `Cannot safely restore global configuration because ${statePath} has an unsupported format.`
      );
    }
    return state;
  }

  private writeProfile(): void {
    const profilePath = this.configManager.getProfilePath();
    const original = fs.existsSync(profilePath) ? fs.readFileSync(profilePath, 'utf8') : '';
    if (original.trim()) this.configManager.readTomlFile(profilePath);
    const updated = applyTomlPatches(original, [
      { type: 'set', key: 'model', value: MODEL_1M },
      { type: 'set', key: 'model_context_window', value: CONTEXT_WINDOW_1M },
      { type: 'set', key: 'model_auto_compact_token_limit', value: AUTO_COMPACT_LIMIT },
    ]);
    this.parseTomlText(updated, profilePath);
    this.configManager.writeTextFileAtomic(profilePath, updated);
  }

  private removeManagedProfile(): boolean {
    const profilePath = this.configManager.getProfilePath();
    if (!fs.existsSync(profilePath)) return false;
    const profile = this.configManager.readTomlFile(profilePath);
    if (!isManagedSignature(profile)) {
      throw new ConfigConflictError(
        `Conflict: ${profilePath} no longer contains the codex-1M managed values. ` +
        'Refusing to remove a profile the user may have edited.'
      );
    }
    const original = fs.readFileSync(profilePath, 'utf8');
    const updated = applyTomlPatches(original, [
      { type: 'remove', key: 'model' },
      { type: 'remove', key: 'model_context_window' },
      { type: 'remove', key: 'model_auto_compact_token_limit' },
    ]);
    const remaining = updated.trim() ? this.parseTomlText(updated, profilePath) : {};
    if (Object.keys(remaining).length === 0) this.configManager.removeFile(profilePath);
    else this.configManager.writeTextFileAtomic(profilePath, updated);
    return true;
  }

  private parseTomlText(content: string, filePath: string): CodexConfig {
    try {
      return TOML.parse(content) as CodexConfig;
    } catch (error) {
      throw new Error(`Refusing to write invalid TOML to ${filePath}: ${error}`);
    }
  }

  private enableProfile(): string {
    return this.configManager.runExclusive(() => {
      const config = this.configManager.readConfig();
      const hasLegacyProfile = Boolean(config.profiles?.['1m']);
      if (hasLegacyProfile) this.configManager.createBackup();
      this.writeProfile();
      if (hasLegacyProfile) {
        this.configManager.patchConfig(
          [{ type: 'remove-table', path: ['profiles', '1m'] }],
          false
        );
        if (this.configManager.readConfig().profiles?.['1m']) {
          throw new Error(
            'Legacy profiles.1m uses an unsupported inline TOML shape; the backup and new profile were kept, but config.toml was not changed.'
          );
        }
      }
      return hasLegacyProfile
        ? `Migrated legacy [profiles.1m] to ${this.configManager.getProfilePath()} (backup: ${this.configManager.getBackupPath()}). Use 'codex --profile 1m'.`
        : `1M profile created at ${this.configManager.getProfilePath()}. Use 'codex --profile 1m'.`;
    });
  }

  private enableGlobal(): string {
    return this.configManager.runExclusive(() => {
      const config = this.configManager.readConfig();
      const existingState = this.readState();
      if (existingState) {
        if (isManagedSignature(config)) {
          return '1M global configuration is already enabled; the original snapshot was preserved.';
        }
        throw new ConfigConflictError(
          `Conflict: ${this.configManager.getStatePath()} already exists but current global values no longer match codex-1M. ` +
          'Resolve the saved state manually before enabling again.'
        );
      }

      const state: GlobalConfigState = {
        version: 1,
        createdAt: new Date().toISOString(),
        original: {
          model: snapshotValue(config, 'model'),
          model_context_window: snapshotValue(config, 'model_context_window'),
          model_auto_compact_token_limit: snapshotValue(config, 'model_auto_compact_token_limit'),
        },
        managed: { ...MANAGED_GLOBAL },
      };
      this.configManager.writeTextFileAtomic(
        this.configManager.getStatePath(),
        `${JSON.stringify(state, null, 2)}\n`
      );
      try {
        this.configManager.patchConfig([
          { type: 'set', key: 'model', value: MODEL_1M },
          { type: 'set', key: 'model_context_window', value: CONTEXT_WINDOW_1M },
          { type: 'set', key: 'model_auto_compact_token_limit', value: AUTO_COMPACT_LIMIT },
        ]);
      } catch (error) {
        this.configManager.removeFile(this.configManager.getStatePath());
        throw error;
      }
      return `1M global configuration enabled. Original values saved to ${this.configManager.getStatePath()}. Restart Codex.`;
    });
  }

  enable1MContext(global: boolean = false): string {
    return global ? this.enableGlobal() : this.enableProfile();
  }

  private restoreGlobalIfManaged(createBackup: boolean = true): string[] {
    const config = this.configManager.readConfig();
    const state = this.readState();
    if (!state) {
      if (isManagedSignature(config)) {
        throw new ConfigConflictError(
          `Conflict: global codex-1M values are present but ${this.configManager.getStatePath()} is missing. ` +
          'Refusing to delete values without the original snapshot.'
        );
      }
      return [];
    }

    const conflicts = Object.entries(MANAGED_GLOBAL)
      .filter(([key, value]) => config[key] !== value)
      .map(([key]) => key);
    if (conflicts.length > 0) {
      throw new ConfigConflictError(
        `Conflict: user-modified global setting(s): ${conflicts.join(', ')}. ` +
        'No values were restored or deleted; review config.toml and codex-1m-state.json, then decide manually.'
      );
    }

    const patches: TomlPatch[] = [];
    for (const key of Object.keys(MANAGED_GLOBAL) as Array<keyof typeof MANAGED_GLOBAL>) {
      const snapshot = state.original[key];
      patches.push(snapshot.existed
        ? { type: 'set', key, value: snapshot.value as string | number }
        : { type: 'remove', key });
    }
    this.configManager.patchConfig(patches, createBackup);
    this.configManager.removeFile(this.configManager.getStatePath());
    return Object.keys(MANAGED_GLOBAL);
  }

  disable1MContext(global: boolean = false): string {
    return this.configManager.runExclusive(() => {
      if (global) {
        const restored = this.restoreGlobalIfManaged();
        return restored.length > 0
          ? '1M global configuration disabled and the pre-enable snapshot was restored. Restart Codex.'
          : '1M global configuration is already disabled.';
      }

      const config = this.configManager.readConfig();
      const hasLegacyProfile = Boolean(config.profiles?.['1m']);
      const hasProfileFile = fs.existsSync(this.configManager.getProfilePath());
      if (hasLegacyProfile) this.configManager.createBackup();
      if (hasProfileFile) this.removeManagedProfile();
      if (hasLegacyProfile) {
        this.configManager.patchConfig(
          [{ type: 'remove-table', path: ['profiles', '1m'] }],
          false
        );
      }
      return hasLegacyProfile || hasProfileFile
        ? '1M profile configuration removed. Start a new Codex conversation.'
        : '1M profile configuration is already absent.';
    });
  }

  getStatus(): ConfigStatus {
    const config = this.configManager.readConfig();
    let profileAvailable = false;
    try {
      const profilePath = this.configManager.getProfilePath();
      profileAvailable = fs.existsSync(profilePath) &&
        isManagedSignature(this.configManager.readTomlFile(profilePath));
    } catch {
      profileAvailable = false;
    }
    const globalEnabled = isManagedSignature(config);
    return {
      configured: globalEnabled || profileAvailable,
      globalConfiguration: globalEnabled ? 'enabled' : 'disabled',
      profileFile: profileAvailable ? 'available' : 'missing',
      currentConversation: 'unknown',
    };
  }

  registerMCPServer(
    command: string = process.execPath,
    args: string[] = [path.join(__dirname, 'mcp-server.js')]
  ): string {
    this.configManager.patchConfig([{
      type: 'set-table',
      path: ['mcp_servers', 'codex-1m'],
      value: {
        command,
        args,
        description: 'Toggle 1M context window from within Codex',
      },
    }]);
    return 'MCP server registered successfully.';
  }

  hasUninstallArtifacts(config: CodexConfig = this.configManager.readConfig()): boolean {
    return Boolean(
      hasAnyManagedValue(config) ||
      config.profiles?.['1m'] ||
      config.mcp_servers?.['codex-1m'] ||
      fs.existsSync(this.configManager.getProfilePath()) ||
      fs.existsSync(this.configManager.getStatePath()) ||
      config.plugins?.['codex-1m@codex-1m'] ||
      config.marketplaces?.['codex-1m']
    );
  }

  uninstallConfiguration(): UninstallConfigResult {
    return this.configManager.runExclusive(() => {
      const removed: string[] = [];
      const restored = this.restoreGlobalIfManaged(false);
      if (restored.length > 0) removed.push('global 1M values (snapshot restored)');

      const config = this.configManager.readConfig();
      const patches: TomlPatch[] = [];
      if (config.profiles?.['1m']) {
        patches.push({ type: 'remove-table', path: ['profiles', '1m'] });
        removed.push('profiles.1m');
      }
      if (config.mcp_servers?.['codex-1m']) {
        patches.push({ type: 'remove-table', path: ['mcp_servers', 'codex-1m'] });
        removed.push('mcp_servers.codex-1m');
      }
      if (patches.length > 0) this.configManager.patchConfig(patches, false);
      if (fs.existsSync(this.configManager.getProfilePath())) {
        this.removeManagedProfile();
        removed.push('1m.config.toml');
      }
      return { changed: removed.length > 0, removed };
    });
  }
}
