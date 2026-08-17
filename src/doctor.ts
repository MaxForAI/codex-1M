import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as TOML from '@iarna/toml';
import {
  CodexRunner,
  createCodexRunner,
  findMarketplace,
  MARKETPLACE_NAME,
  PLUGIN_ID,
} from './integration';
import {
  AUTO_COMPACT_LIMIT,
  CONTEXT_WINDOW_1M,
  MODEL_1M,
} from './config-modifier';

export interface DoctorResult {
  codexCliVersion: string;
  repositoryVersion: string;
  installedPluginVersion: string;
  configMode: string;
  mcpServerPath: string;
  mcpServerExists: boolean;
  mcpServerExecutable: boolean;
  profileFilePath: string;
  profileFileExists: boolean;
  stateFilePath: string;
  stateFileExists: boolean;
}

function readToml(filePath: string): Record<string, any> {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  return content.trim() ? TOML.parse(content) as Record<string, any> : {};
}

function isManaged(config: Record<string, any>): boolean {
  return config.model === MODEL_1M &&
    config.model_context_window === CONTEXT_WINDOW_1M &&
    config.model_auto_compact_token_limit === AUTO_COMPACT_LIMIT;
}

function readManifestVersion(root: unknown): string {
  if (typeof root !== 'string') return 'unavailable';
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, '.codex-plugin', 'plugin.json'), 'utf8')
    );
    return typeof manifest.version === 'string' ? manifest.version : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

function installedPlugin(pluginList: any): any {
  return Array.isArray(pluginList?.installed)
    ? pluginList.installed.find((entry: any) => entry.pluginId === PLUGIN_ID)
    : undefined;
}

function resolvePluginRoot(codexHome: string, plugin: any): string | null {
  if (!plugin) return null;
  if (typeof plugin.installedPath === 'string') return plugin.installedPath;
  if (typeof plugin.version === 'string') {
    const cached = path.join(
      codexHome,
      'plugins',
      'cache',
      MARKETPLACE_NAME,
      MARKETPLACE_NAME,
      plugin.version
    );
    if (fs.existsSync(cached)) return cached;
  }
  return typeof plugin.source?.path === 'string' ? plugin.source.path : null;
}

export function doctorCodex1M(options: {
  runner?: CodexRunner;
  codexHome?: string;
} = {}): DoctorResult {
  const runner = options.runner || createCodexRunner();
  const codexHome = options.codexHome || process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  let codexCliVersion = 'unavailable';
  let marketplaceList: any = {};
  let pluginList: any = {};
  try { codexCliVersion = runner.runText(['--version']); } catch {}
  try { marketplaceList = runner.run(['plugin', 'marketplace', 'list', '--json']); } catch {}
  try { pluginList = runner.run(['plugin', 'list', '--json']); } catch {}

  const marketplace = findMarketplace(marketplaceList);
  const plugin = installedPlugin(pluginList);
  const profileFilePath = path.join(codexHome, '1m.config.toml');
  const stateFilePath = path.join(codexHome, 'codex-1m-state.json');
  const baseConfig = readToml(path.join(codexHome, 'config.toml'));
  const profileConfig = readToml(profileFilePath);
  const global = isManaged(baseConfig);
  const profile = isManaged(profileConfig);
  const configMode = global
    ? profile ? 'global (profile file also configured)' : 'global'
    : profile ? 'profile file' : 'not configured';

  const pluginRoot = resolvePluginRoot(codexHome, plugin);
  const mcpServerPath = pluginRoot
    ? path.join(pluginRoot, 'mcp', 'server.cjs')
    : 'unavailable (plugin not installed)';
  const mcpServerExists = pluginRoot !== null && fs.existsSync(mcpServerPath);
  let nodeExecutable = false;
  try {
    fs.accessSync(process.execPath, fs.constants.X_OK);
    nodeExecutable = true;
  } catch {}

  return {
    codexCliVersion,
    repositoryVersion: readManifestVersion(marketplace?.root),
    installedPluginVersion: typeof plugin?.version === 'string' ? plugin.version : 'not installed',
    configMode,
    mcpServerPath,
    mcpServerExists,
    mcpServerExecutable: mcpServerExists && nodeExecutable,
    profileFilePath,
    profileFileExists: fs.existsSync(profileFilePath),
    stateFilePath,
    stateFileExists: fs.existsSync(stateFilePath),
  };
}

export function formatDoctorResult(result: DoctorResult): string {
  return [
    '1m doctor',
    '=========',
    `Codex CLI version: ${result.codexCliVersion}`,
    `Repository/remote version: ${result.repositoryVersion} (configured marketplace snapshot)`,
    `Installed plugin version: ${result.installedPluginVersion}`,
    `Configuration mode: ${result.configMode}`,
    `MCP server path: ${result.mcpServerPath}`,
    `MCP server exists: ${result.mcpServerExists ? 'yes' : 'no'}`,
    `MCP server executable: ${result.mcpServerExecutable ? 'yes (via Node.js)' : 'no'}`,
    `1m.config.toml: ${result.profileFileExists ? 'exists' : 'missing'} (${result.profileFilePath})`,
    `codex-1m-state.json: ${result.stateFileExists ? 'exists' : 'missing'} (${result.stateFilePath})`,
  ].join('\n');
}
