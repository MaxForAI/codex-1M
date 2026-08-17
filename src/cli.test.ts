import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runCli } from './cli';

describe('CLI surface', () => {
  let codexHome: string;
  let log: jest.SpyInstance;
  let error: jest.SpyInstance;
  const previousHome = process.env.CODEX_HOME;
  const previousBinary = process.env.CODEX_BIN;

  beforeEach(() => {
    codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-1m-cli-'));
    process.env.CODEX_HOME = codexHome;
    process.env.CODEX_BIN = path.join(codexHome, 'missing-codex');
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    log.mockRestore();
    error.mockRestore();
    fs.rmSync(codexHome, { recursive: true, force: true });
    if (previousHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousHome;
    if (previousBinary === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previousBinary;
  });

  it('uses the bare command for install and uninstall as the only subcommand', async () => {
    expect(await runCli([])).toBe(0);
    expect(log.mock.calls.flat().join('\n')).toContain('✓ Codex 1M context enabled');

    log.mockClear();
    expect(await runCli(['uninstall'])).toBe(0);
    expect(log.mock.calls.flat().join('\n')).toContain('✓ Codex 1M context uninstalled');

    expect(await runCli(['install'])).toBe(1);
    expect(await runCli(['on'])).toBe(1);
    expect(error).toHaveBeenCalledWith('Usage: codex-1m [uninstall]');
  });

  it('publishes one executable that npx can resolve from the package name', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    expect(manifest.version).toBe('3.0.0');
    expect(manifest.bin).toEqual({ 'codex-1m': './dist/cli.js' });
  });
});
