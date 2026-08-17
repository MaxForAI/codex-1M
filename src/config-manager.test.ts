import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigManager } from './config-manager';

describe('ConfigManager safety core', () => {
  let directory: string;
  let configPath: string;
  let manager: ConfigManager;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-1m-config-'));
    configPath = path.join(directory, 'config.toml');
    manager = new ConfigManager(configPath);
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  it('surgically patches top-level values while preserving comments and tables', () => {
    fs.writeFileSync(configPath, [
      '# user comment',
      'model   =   "old" # inline comment',
      'approval_policy = "never"',
      '',
      '[mcp_servers.other]',
      'command = "keep"',
      '',
    ].join('\n'));

    manager.patchConfig([
      { type: 'set', key: 'model', value: 'new' },
      { type: 'set', key: 'model_context_window', value: 1000000 },
    ]);

    const text = fs.readFileSync(configPath, 'utf8');
    expect(text).toContain('# user comment');
    expect(text).toContain('model   =   "new" # inline comment');
    expect(text).toContain('[mcp_servers.other]\ncommand = "keep"');
    expect(manager.readConfig().model_context_window).toBe(1000000);
    expect(fs.readdirSync(directory).some((name) => name.includes('.tmp-'))).toBe(false);
    expect(fs.existsSync(path.join(directory, '.codex-1m.lock'))).toBe(false);
  });

  it('creates an empty config atomically when it does not exist', () => {
    expect(fs.existsSync(configPath)).toBe(true);
    expect(fs.readFileSync(configPath, 'utf8')).toBe('');
    expect(fs.statSync(configPath).mode & 0o777).toBe(0o600);
  });
});
