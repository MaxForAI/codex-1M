#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const TOML = require('@iarna/toml');

const repoRoot = path.resolve(__dirname, '..');
const cliPath = path.join(repoRoot, 'dist', 'cli.js');
const minimumCodexVersion = [0, 134, 0];

function resolveCodexBinary() {
  if (process.env.CODEX_BIN) return process.env.CODEX_BIN;
  try {
    return execFileSync(process.platform === 'win32' ? 'where' : 'which', ['codex'], {
      encoding: 'utf8',
    }).trim().split(/\r?\n/)[0];
  } catch {}

  const appBinary = '/Applications/ChatGPT.app/Contents/Resources/codex';
  if (process.platform === 'darwin' && fs.existsSync(appBinary)) return appBinary;
  return null;
}

function parseVersion(output) {
  const match = output.match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}

function versionAtLeast(actual, minimum) {
  for (let index = 0; index < minimum.length; index += 1) {
    if (actual[index] > minimum[index]) return true;
    if (actual[index] < minimum[index]) return false;
  }
  return true;
}

function run(binary, args, env) {
  const output = execFileSync(binary, args, {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return output.trim();
}

function runCli(commandArgs, env) {
  const output = run(process.execPath, [cliPath, ...commandArgs], env);
  process.stdout.write(`[${commandArgs.join(' ')}]\n${output}\n`);
  return output;
}

function runCliConcurrent(commandArgs, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...commandArgs], {
      cwd: repoRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Concurrent CLI exited ${code}: ${stderr || stdout}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

function mode(filePath) {
  return fs.statSync(filePath).mode & 0o777;
}

async function main() {
  if (!fs.existsSync(cliPath)) {
    throw new Error('dist/cli.js is missing. Run npm run build first.');
  }

  const codexBinary = resolveCodexBinary();
  if (!codexBinary) {
    const message = 'SKIP: real Codex CLI not found (requires codex-cli >= 0.134.0).';
    if (process.env.CODEX_E2E_REQUIRED === '1') throw new Error(message);
    process.stdout.write(`${message}\n`);
    return;
  }

  const codexVersionOutput = run(codexBinary, ['--version'], process.env);
  const codexVersion = parseVersion(codexVersionOutput);
  if (!codexVersion || !versionAtLeast(codexVersion, minimumCodexVersion)) {
    throw new Error(`Expected codex-cli >= 0.134.0, received: ${codexVersionOutput}`);
  }

  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-1m-real-e2e-'));
  const codexHome = path.join(sandbox, 'codex-home');
  const configPath = path.join(codexHome, 'config.toml');
  const profilePath = path.join(codexHome, '1m.config.toml');
  const statePath = path.join(codexHome, 'codex-1m-state.json');
  const originalConfig = [
    '# real E2E sentinel: preserve this comment',
    'model   =   "gpt-user" # preserve this inline comment',
    'approval_policy = "never"',
    '',
    '[features]',
    'unified_exec = true',
    '',
  ].join('\n');

  fs.mkdirSync(codexHome, { recursive: true });
  fs.writeFileSync(configPath, originalConfig, { encoding: 'utf8', mode: 0o640 });
  fs.chmodSync(configPath, 0o640);

  const env = {
    ...process.env,
    CODEX_BIN: codexBinary,
    CODEX_HOME: codexHome,
    CODEX_1M_MARKETPLACE_SOURCE:
      process.env.CODEX_1M_E2E_SOURCE || 'MaxForAI/codex-1M',
  };

  let succeeded = false;
  process.stdout.write(`Codex: ${codexVersionOutput}\nIsolated CODEX_HOME: ${codexHome}\n`);
  try {
    const installOutput = runCli(['install'], env);
    assert.match(installOutput, /Plugin codex-1m@codex-1m: installed/);

    const updateOutput = runCli(['update'], env);
    assert.match(updateOutput, /Marketplace codex-1m: upgraded/);
    assert.match(updateOutput, /Plugin codex-1m@codex-1m: reinstalled/);

    const doctorOutput = runCli(['doctor'], env);
    assert.match(doctorOutput, new RegExp(`Codex CLI version: ${codexVersionOutput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.match(doctorOutput, /Installed plugin version: \d+\.\d+\.\d+/);
    assert.match(doctorOutput, /MCP server exists: yes/);

    const configAfterPluginLifecycle = fs.readFileSync(configPath, 'utf8');
    const configModeAfterPluginLifecycle = mode(configPath);
    assert.match(configAfterPluginLifecycle, /# real E2E sentinel: preserve this comment/);
    assert.match(configAfterPluginLifecycle, /model   =   "gpt-user" # preserve this inline comment/);
    assert.equal(configModeAfterPluginLifecycle & 0o077, 0, 'Codex config must not be group/world accessible');

    runCli(['on'], env);
    assert.equal(
      fs.readFileSync(configPath, 'utf8'),
      configAfterPluginLifecycle,
      'profile on changed base config formatting'
    );
    assert.equal(mode(configPath), configModeAfterPluginLifecycle, 'base config mode changed');
    assert.equal(mode(profilePath), 0o600, 'profile must be owner-only');
    const profile = TOML.parse(fs.readFileSync(profilePath, 'utf8'));
    assert.equal(profile.model_context_window, 1000000);

    const profileState = runCli(['state'], env);
    assert.match(profileState, /1M Configured: Yes/);
    assert.match(profileState, /Current conversation: unknown/);

    runCli(['off'], env);
    assert.equal(fs.existsSync(profilePath), false, 'profile remains after off');
    assert.equal(
      fs.readFileSync(configPath, 'utf8'),
      configAfterPluginLifecycle,
      'profile off changed base config formatting'
    );

    const concurrent = await Promise.all([
      runCliConcurrent(['on', '--global'], env),
      runCliConcurrent(['on', '--global'], env),
    ]);
    process.stdout.write(`[concurrent on --global]\n${concurrent.join('\n')}\n`);
    const globalConfig = TOML.parse(fs.readFileSync(configPath, 'utf8'));
    assert.equal(globalConfig.model, 'gpt-5.6-sol');
    assert.equal(globalConfig.model_context_window, 1000000);
    assert.equal(globalConfig.model_auto_compact_token_limit, 900000);
    assert.equal(
      mode(configPath),
      configModeAfterPluginLifecycle,
      'atomic update did not preserve config mode'
    );
    assert.equal(mode(statePath), 0o600, 'state file must be owner-only');
    assert.equal(fs.existsSync(path.join(codexHome, '.codex-1m.lock')), false, 'lock file leaked');
    assert.equal(
      fs.readdirSync(codexHome).some((name) => name.includes('.tmp-')),
      false,
      'atomic temporary file leaked'
    );

    runCli(['off', '--global'], env);
    assert.equal(
      fs.readFileSync(configPath, 'utf8'),
      configAfterPluginLifecycle,
      'global round-trip did not preserve comments/formatting'
    );
    assert.equal(fs.existsSync(statePath), false, 'state remains after global off');

    const uninstallOutput = runCli(['uninstall'], env);
    assert.match(uninstallOutput, /Plugin codex-1m@codex-1m: removed/);
    assert.match(uninstallOutput, /Marketplace codex-1m: removed/);

    const pluginList = JSON.parse(run(codexBinary, ['plugin', 'list', '--json'], env));
    const marketplaceList = JSON.parse(run(codexBinary, ['plugin', 'marketplace', 'list', '--json'], env));
    assert.equal(pluginList.installed.some((entry) => entry.pluginId === 'codex-1m@codex-1m'), false);
    assert.equal(marketplaceList.marketplaces.some((entry) => entry.name === 'codex-1m'), false);
    assert.equal(fs.readFileSync(configPath, 'utf8'), originalConfig);

    succeeded = true;
    process.stdout.write('PASS: real Codex isolated lifecycle, formatting, permissions, and concurrent writes.\n');
  } finally {
    if (succeeded && process.env.CODEX_1M_E2E_KEEP !== '1') {
      fs.rmSync(sandbox, { recursive: true, force: true });
    } else {
      process.stdout.write(`E2E artifacts retained at: ${sandbox}\n`);
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
