import { ConfigManager, CodexConfig } from './config-manager';

export interface ConfigStatus {
  model: string;
  model_context_window: number;
  model_auto_compact_token_limit: number;
  enabled: boolean;
}

export interface UninstallConfigResult {
  changed: boolean;
  removed: string[];
}

const MODEL_1M = 'gpt-5.6-sol';
const CONTEXT_WINDOW_1M = 1000000;
const AUTO_COMPACT_LIMIT = 900000;

export class ConfigModifier {
  constructor(private configManager: ConfigManager) {}

  enable1MContext(global: boolean = false): string {
    const config = this.configManager.readConfig();

    if (global) {
      // Modify top-level configuration
      config.model = MODEL_1M;
      config.model_context_window = CONTEXT_WINDOW_1M;
      config.model_auto_compact_token_limit = AUTO_COMPACT_LIMIT;
    } else {
      // Inject profile
      if (!config.profiles) {
        config.profiles = {};
      }
      config.profiles['1m'] = {
        model: MODEL_1M,
        model_context_window: CONTEXT_WINDOW_1M,
        model_auto_compact_token_limit: AUTO_COMPACT_LIMIT
      };
    }

    this.configManager.writeConfig(config);

    if (global) {
      return `1M context enabled globally. Restart Codex for changes to take effect.`;
    } else {
      return `1M profile created. Use 'codex --profile 1m' to start with 1M context.`;
    }
  }

  disable1MContext(global: boolean = false): string {
    const config = this.configManager.readConfig();

    if (global) {
      // Remove top-level 1M settings
      delete config.model;
      delete config.model_context_window;
      delete config.model_auto_compact_token_limit;
    } else {
      // Remove profile
      if (config.profiles && config.profiles['1m']) {
        delete config.profiles['1m'];
      }
    }

    this.configManager.writeConfig(config);
    return `1M context disabled. Restart Codex for changes to take effect.`;
  }

  getStatus(): ConfigStatus {
    const config = this.configManager.readConfig();
    const status: ConfigStatus = {
      model: config.model || 'default',
      model_context_window: config.model_context_window || 0,
      model_auto_compact_token_limit: config.model_auto_compact_token_limit || 0,
      enabled: false
    };

    // Check if 1M context is enabled globally
    if (config.model === MODEL_1M &&
        config.model_context_window === CONTEXT_WINDOW_1M &&
        config.model_auto_compact_token_limit === AUTO_COMPACT_LIMIT) {
      status.enabled = true;
    }

    return status;
  }

  registerMCPServer(): string {
    const config = this.configManager.readConfig();

    if (!config.mcp_servers) {
      config.mcp_servers = {};
    }

    config.mcp_servers['codex-1m'] = {
      command: 'npx',
      args: ['codex-1m-mcp'],
      description: 'Toggle 1M context window from within Codex'
    };

    this.configManager.writeConfig(config);
    return 'MCP server registered successfully.';
  }

  hasUninstallArtifacts(config: CodexConfig = this.configManager.readConfig()): boolean {
    const hasManagedGlobalConfig =
      config.model === MODEL_1M &&
      config.model_context_window === CONTEXT_WINDOW_1M &&
      config.model_auto_compact_token_limit === AUTO_COMPACT_LIMIT;

    return Boolean(
      hasManagedGlobalConfig ||
      config.profiles?.['1m'] ||
      config.mcp_servers?.['codex-1m'] ||
      config.plugins?.['codex-1m@codex-1m'] ||
      config.marketplaces?.['codex-1m']
    );
  }

  uninstallConfiguration(): UninstallConfigResult {
    const config = this.configManager.readConfig();
    const removed: string[] = [];

    const hasManagedGlobalConfig =
      config.model === MODEL_1M &&
      config.model_context_window === CONTEXT_WINDOW_1M &&
      config.model_auto_compact_token_limit === AUTO_COMPACT_LIMIT;

    if (hasManagedGlobalConfig) {
      delete config.model;
      delete config.model_context_window;
      delete config.model_auto_compact_token_limit;
      removed.push(
        'model',
        'model_context_window',
        'model_auto_compact_token_limit'
      );
    }

    if (config.profiles?.['1m']) {
      delete config.profiles['1m'];
      removed.push('profiles.1m');
      if (Object.keys(config.profiles).length === 0) {
        delete config.profiles;
      }
    }

    if (config.mcp_servers?.['codex-1m']) {
      delete config.mcp_servers['codex-1m'];
      removed.push('mcp_servers.codex-1m');
      if (Object.keys(config.mcp_servers).length === 0) {
        delete config.mcp_servers;
      }
    }

    if (removed.length > 0) {
      // The uninstall coordinator creates one backup before any cleanup. Avoid
      // replacing it with a backup of an already partially cleaned config.
      this.configManager.writeConfig(config, false);
    }

    return { changed: removed.length > 0, removed };
  }
}
