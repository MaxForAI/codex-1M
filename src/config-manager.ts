import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as TOML from '@iarna/toml';

export interface CodexConfig {
  model?: string;
  model_context_window?: number;
  model_auto_compact_token_limit?: number;
  profiles?: Record<string, any>;
  mcp_servers?: Record<string, any>;
  [key: string]: any;
}

export class ConfigManager {
  private configPath: string;
  private backupPath: string;

  constructor(configPath?: string) {
    const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
    this.configPath = configPath || path.join(codexHome, 'config.toml');
    this.backupPath = ''; // Will be set when backup is created
    this.ensureConfigExists();
  }

  private setBackupPath(): void {
    this.backupPath = `${this.configPath}.bak.${Date.now()}`;
  }

  private ensureConfigExists(): void {
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    if (!fs.existsSync(this.configPath)) {
      fs.writeFileSync(this.configPath, '', 'utf-8');
    }
  }

  createBackup(): string {
    if (fs.existsSync(this.configPath)) {
      this.setBackupPath();
      fs.copyFileSync(this.configPath, this.backupPath);
    }
    return this.backupPath;
  }

  readConfig(): CodexConfig {
    this.ensureConfigExists();
    const content = fs.readFileSync(this.configPath, 'utf-8');
    if (content.trim() === '') {
      return {};
    }
    try {
      return TOML.parse(content) as CodexConfig;
    } catch (error) {
      throw new Error(`Failed to parse config file: ${error}`);
    }
  }

  writeConfig(config: CodexConfig, createBackup: boolean = true): void {
    if (createBackup) {
      this.createBackup();
    }
    const tomlContent = TOML.stringify(config);
    fs.writeFileSync(this.configPath, tomlContent, 'utf-8');
  }

  getBackupPath(): string {
    if (!this.backupPath) {
      this.setBackupPath();
    }
    return this.backupPath;
  }

  getConfigPath(): string {
    return this.configPath;
  }

  static getFixturesPath(): string {
    return path.join(__dirname, '..', 'fixtures');
  }
}
