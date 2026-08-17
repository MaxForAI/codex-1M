import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager, CodexConfig } from './config-manager';
import { ConfigModifier } from './config-modifier';

describe('ConfigManager', () => {
  let tempDir: string;
  let configPath: string;
  let manager: ConfigManager;

  beforeEach(() => {
    // Create temp directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-1m-test-'));
    configPath = path.join(tempDir, 'config.toml');
    manager = new ConfigManager(configPath);
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Config file creation', () => {
    it('should create config directory if it does not exist', () => {
      expect(fs.existsSync(path.dirname(configPath))).toBe(true);
      expect(fs.existsSync(configPath)).toBe(true);
    });

    it('should create empty config if file does not exist', () => {
      const config = manager.readConfig();
      expect(config).toEqual({});
    });
  });

  describe('Config reading and writing', () => {
    it('should read and write config correctly', () => {
      const testConfig: CodexConfig = {
        model: 'gpt-4',
        temperature: 0.7,
        profiles: {
          small: {
            model: 'gpt-3.5-turbo',
            max_tokens: 4096
          }
        }
      };

      manager.writeConfig(testConfig);
      const readConfig = manager.readConfig();

      expect(readConfig).toEqual(testConfig);
    });

    it('should preserve existing config when writing', () => {
      const originalConfig: CodexConfig = {
        model: 'gpt-4',
        mcp_servers: {
          test: {
            command: 'echo',
            args: ['test']
          }
        }
      };

      manager.writeConfig(originalConfig);

      const updatedConfig = manager.readConfig();
      updatedConfig.temperature = 0.8;
      manager.writeConfig(updatedConfig);

      const finalConfig = manager.readConfig();
      expect(finalConfig.mcp_servers).toEqual(originalConfig.mcp_servers);
    });
  });

  describe('Backup functionality', () => {
    it('should create backup when writing config', () => {
      // First write some content
      const initialConfig: CodexConfig = { model: 'gpt-3.5' };
      manager.writeConfig(initialConfig);

      // Then write again to trigger backup
      const testConfig: CodexConfig = { model: 'gpt-4' };
      manager.writeConfig(testConfig);

      const backupPath = manager.getBackupPath();
      expect(fs.existsSync(backupPath)).toBe(true);

      const backupContent = fs.readFileSync(backupPath, 'utf-8');
      expect(backupContent).toContain('model = "gpt-3.5"'); // Should contain previous config
    });

    it('should create timestamped backups', () => {
      manager.writeConfig({ model: 'gpt-4' });
      const firstBackup = manager.getBackupPath();

      // Wait a bit to ensure different timestamp
      const start = Date.now();
      while (Date.now() - start < 2) { /* wait */ }

      const manager2 = new ConfigManager(configPath);
      manager2.writeConfig({ model: 'gpt-3.5' });
      const secondBackup = manager2.getBackupPath();

      expect(firstBackup).not.toBe(secondBackup);
    });
  });
});

describe('ConfigModifier', () => {
  let tempDir: string;
  let configPath: string;
  let manager: ConfigManager;
  let modifier: ConfigModifier;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-1m-modifier-test-'));
    configPath = path.join(tempDir, 'config.toml');
    manager = new ConfigManager(configPath);
    modifier = new ConfigModifier(manager);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('1M Context Profile', () => {
    it('should create 1M profile correctly', () => {
      modifier.enable1MContext(false);

      const config = manager.readConfig();
      expect(config.profiles?.['1m']).toBeDefined();
      expect(config.profiles?.['1m']).toEqual({
        model: 'gpt-5.6-sol',
        model_context_window: 1000000,
        model_auto_compact_token_limit: 900000
      });
    });

    it('should preserve existing configs when creating profile', () => {
      const existingConfig: CodexConfig = {
        model: 'gpt-4',
        profiles: {
          small: { model: 'gpt-3.5-turbo' }
        },
        mcp_servers: {
          test: { command: 'echo' }
        }
      };
      manager.writeConfig(existingConfig);

      modifier.enable1MContext(false);

      const config = manager.readConfig();
      expect(config.model).toBe('gpt-4'); // Should not change
      expect(config.profiles?.['small']).toBeDefined(); // Should preserve existing profile
      expect(config.mcp_servers?.['test']).toBeDefined(); // Should preserve MCP servers
      expect(config.profiles?.['1m']).toBeDefined(); // Should add 1M profile
    });

    it('should be idempotent - running twice should not duplicate', () => {
      modifier.enable1MContext(false);
      const firstConfig = manager.readConfig();

      modifier.enable1MContext(false);
      const secondConfig = manager.readConfig();

      expect(firstConfig).toEqual(secondConfig);
    });

    it('should remove 1M profile correctly', () => {
      modifier.enable1MContext(false);
      expect(manager.readConfig().profiles?.['1m']).toBeDefined();

      modifier.disable1MContext(false);
      expect(manager.readConfig().profiles?.['1m']).toBeUndefined();
    });
  });

  describe('1M Context Global', () => {
    it('should enable 1M context globally', () => {
      modifier.enable1MContext(true);

      const config = manager.readConfig();
      expect(config.model).toBe('gpt-5.6-sol');
      expect(config.model_context_window).toBe(1000000);
      expect(config.model_auto_compact_token_limit).toBe(900000);
    });

    it('should disable 1M context globally', () => {
      modifier.enable1MContext(true);
      expect(manager.readConfig().model).toBe('gpt-5.6-sol');

      modifier.disable1MContext(true);
      const config = manager.readConfig();
      expect(config.model).toBeUndefined();
      expect(config.model_context_window).toBeUndefined();
      expect(config.model_auto_compact_token_limit).toBeUndefined();
    });
  });

  describe('Status Check', () => {
    it('should report disabled status correctly', () => {
      const status = modifier.getStatus();
      expect(status.enabled).toBe(false);
      expect(status.model).toBe('default');
    });

    it('should report enabled status correctly when globally enabled', () => {
      modifier.enable1MContext(true);
      const status = modifier.getStatus();
      expect(status.enabled).toBe(true);
      expect(status.model).toBe('gpt-5.6-sol');
    });

    it('should report disabled when only profile exists', () => {
      modifier.enable1MContext(false);
      const status = modifier.getStatus();
      expect(status.enabled).toBe(false); // Not globally enabled
      expect(status.model).toBe('default');
    });
  });

  describe('MCP Server Registration', () => {
    it('should register MCP server correctly', () => {
      modifier.registerMCPServer();

      const config = manager.readConfig();
      expect(config.mcp_servers?.['codex-1m']).toBeDefined();
      expect(config.mcp_servers?.['codex-1m']).toEqual({
        command: process.execPath,
        args: [path.join(__dirname, 'mcp-server.js')],
        description: 'Toggle 1M context window from within Codex'
      });
    });

    it('should preserve existing MCP servers', () => {
      const existingConfig: CodexConfig = {
        mcp_servers: {
          existing: { command: 'echo' }
        }
      };
      manager.writeConfig(existingConfig);

      modifier.registerMCPServer();

      const config = manager.readConfig();
      expect(config.mcp_servers?.['existing']).toBeDefined();
      expect(config.mcp_servers?.['codex-1m']).toBeDefined();
    });

    it('should be idempotent', () => {
      modifier.registerMCPServer();
      const firstConfig = manager.readConfig();

      modifier.registerMCPServer();
      const secondConfig = manager.readConfig();

      expect(firstConfig.mcp_servers?.['codex-1m']).toEqual(secondConfig.mcp_servers?.['codex-1m']);
    });
  });
});
