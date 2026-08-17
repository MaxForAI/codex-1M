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

export type TomlPatch =
  | { type: 'set'; key: string; value: string | number | boolean | string[] }
  | { type: 'remove'; key: string }
  | { type: 'set-table'; path: string[]; value: Record<string, any> }
  | { type: 'remove-table'; path: string[] };

const LOCK_TIMEOUT_MS = 5000;
const STALE_LOCK_MS = 30000;

function sleepSync(milliseconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function parseHeaderPath(line: string): string[] | null {
  const match = line.trim().match(/^\[([^\[\]]+)\](?:\s*#.*)?$/);
  if (!match) return null;
  const parts: string[] = [];
  let current = '';
  let quote = '';
  for (const character of match[1]) {
    if (quote) {
      if (character === quote) quote = '';
      else current += character;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '.') {
      parts.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  parts.push(current.trim());
  return parts;
}

function findInlineComment(value: string): number {
  let quote = '';
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote === '"' && character === '\\' && !escaped) {
      escaped = true;
      continue;
    }
    if (!escaped && (character === '"' || character === "'")) {
      if (!quote) quote = character;
      else if (quote === character) quote = '';
    }
    if (!quote && character === '#') return index;
    escaped = false;
  }
  return -1;
}

function scalarToml(key: string, value: any): string {
  const line = TOML.stringify({ [key]: value }).trim();
  return line.slice(line.indexOf('=') + 1).trim();
}

function patchTopLevel(content: string, key: string, value?: any): string {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const hadFinalNewline = content.endsWith('\n');
  const lines = content.split(/\r?\n/);
  if (hadFinalNewline) lines.pop();
  const firstTable = lines.findIndex((line) => parseHeaderPath(line) !== null);
  const limit = firstTable === -1 ? lines.length : firstTable;
  const keyPattern = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(`^(\\s*)${keyPattern}(\\s*=\\s*)(.*)$`);

  for (let index = 0; index < limit; index += 1) {
    const match = lines[index].match(matcher);
    if (!match) continue;
    if (value === undefined) {
      lines.splice(index, 1);
    } else {
      const commentAt = findInlineComment(match[3]);
      const comment = commentAt >= 0 ? ` ${match[3].slice(commentAt).trimStart()}` : '';
      lines[index] = `${match[1]}${key}${match[2]}${scalarToml(key, value)}${comment}`;
    }
    return lines.join(newline) + (hadFinalNewline ? newline : '');
  }

  if (value !== undefined) lines.splice(limit, 0, `${key} = ${scalarToml(key, value)}`);
  return lines.join(newline) + (hadFinalNewline || lines.length > 0 ? newline : '');
}

function removeTable(content: string, targetPath: string[]): string {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const hadFinalNewline = content.endsWith('\n');
  const lines = content.split(/\r?\n/);
  if (hadFinalNewline) lines.pop();
  const start = lines.findIndex((line) => {
    const header = parseHeaderPath(line);
    return header && header.length === targetPath.length &&
      header.every((part, index) => part === targetPath[index]);
  });
  if (start === -1) return content;
  let end = start + 1;
  while (end < lines.length && parseHeaderPath(lines[end]) === null) end += 1;
  let managedEnd = end;
  while (
    managedEnd > start + 1 &&
    (lines[managedEnd - 1].trim() === '' || lines[managedEnd - 1].trimStart().startsWith('#'))
  ) {
    managedEnd -= 1;
  }
  lines.splice(start, managedEnd - start);
  return lines.join(newline) + (hadFinalNewline && lines.length > 0 ? newline : '');
}

export function applyTomlPatches(content: string, patches: TomlPatch[]): string {
  let updated = content;
  for (const patch of patches) {
    if (patch.type === 'set') updated = patchTopLevel(updated, patch.key, patch.value);
    if (patch.type === 'remove') updated = patchTopLevel(updated, patch.key);
    if (patch.type === 'remove-table') updated = removeTable(updated, patch.path);
    if (patch.type === 'set-table') {
      updated = removeTable(updated, patch.path);
      const body = TOML.stringify(patch.value).trimEnd();
      const separator = !updated ? '' : updated.endsWith('\n\n') ? '' : updated.endsWith('\n') ? '\n' : '\n\n';
      updated = `${updated}${separator}[${patch.path.join('.')}]\n${body}\n`;
    }
  }
  return updated;
}

export class ConfigManager {
  private configPath: string;
  private codexHome: string;
  private backupPath = '';
  private lockDepth = 0;

  constructor(configPath?: string) {
    this.codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
    this.configPath = configPath || path.join(this.codexHome, 'config.toml');
    if (configPath) this.codexHome = path.dirname(configPath);
    this.ensureConfigExists();
  }

  private setBackupPath(): void {
    const basePath = `${this.configPath}.bak.${Date.now()}`;
    this.backupPath = basePath;
    let suffix = 1;
    while (fs.existsSync(this.backupPath)) {
      this.backupPath = `${basePath}.${suffix}`;
      suffix += 1;
    }
  }

  private fsyncDirectory(directory: string): void {
    const directoryFd = fs.openSync(directory, 'r');
    try { fs.fsyncSync(directoryFd); } finally { fs.closeSync(directoryFd); }
  }

  private atomicWriteUnlocked(filePath: string, content: string): void {
    const directory = path.dirname(filePath);
    fs.mkdirSync(directory, { recursive: true });
    const temporaryPath = path.join(
      directory,
      `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
    const mode = fs.existsSync(filePath) ? fs.statSync(filePath).mode & 0o777 : 0o600;
    let fileDescriptor: number | undefined;
    try {
      fileDescriptor = fs.openSync(temporaryPath, 'wx', mode);
      fs.fchmodSync(fileDescriptor, mode);
      fs.writeFileSync(fileDescriptor, content, 'utf8');
      fs.fsyncSync(fileDescriptor);
      fs.closeSync(fileDescriptor);
      fileDescriptor = undefined;
      fs.renameSync(temporaryPath, filePath);
      this.fsyncDirectory(directory);
    } finally {
      if (fileDescriptor !== undefined) fs.closeSync(fileDescriptor);
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    }
  }

  runExclusive<T>(operation: () => T): T {
    if (this.lockDepth > 0) return operation();
    fs.mkdirSync(this.codexHome, { recursive: true });
    const lockPath = path.join(this.codexHome, '.codex-1m.lock');
    const deadline = Date.now() + LOCK_TIMEOUT_MS;
    let lockFd: number | undefined;
    while (lockFd === undefined) {
      try {
        lockFd = fs.openSync(lockPath, 'wx', 0o600);
        fs.writeFileSync(lockFd, `${process.pid}\n`, 'utf8');
        fs.fsyncSync(lockFd);
      } catch (error: any) {
        if (error?.code !== 'EEXIST') throw error;
        try {
          if (Date.now() - fs.statSync(lockPath).mtimeMs > STALE_LOCK_MS) {
            fs.unlinkSync(lockPath);
            continue;
          }
        } catch (statError: any) {
          if (statError?.code === 'ENOENT') continue;
          throw statError;
        }
        if (Date.now() >= deadline) {
          throw new Error(`Timed out waiting for Codex configuration lock: ${lockPath}`);
        }
        sleepSync(25);
      }
    }
    this.lockDepth += 1;
    try {
      return operation();
    } finally {
      this.lockDepth -= 1;
      fs.closeSync(lockFd);
      try {
        fs.unlinkSync(lockPath);
        this.fsyncDirectory(this.codexHome);
      } catch (error: any) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
  }

  private ensureConfigExists(): void {
    this.runExclusive(() => {
      if (!fs.existsSync(this.configPath)) this.atomicWriteUnlocked(this.configPath, '');
    });
  }

  createBackup(): string {
    return this.runExclusive(() => {
      if (fs.existsSync(this.configPath)) {
        this.setBackupPath();
        fs.copyFileSync(this.configPath, this.backupPath);
        const backupFd = fs.openSync(this.backupPath, 'r');
        try { fs.fsyncSync(backupFd); } finally { fs.closeSync(backupFd); }
        this.fsyncDirectory(path.dirname(this.backupPath));
      }
      return this.backupPath;
    });
  }

  readTomlFile(filePath: string = this.configPath): CodexConfig {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.trim() === '') return {};
    try {
      return TOML.parse(content) as CodexConfig;
    } catch (error) {
      throw new Error(`Failed to parse config file ${filePath}: ${error}`);
    }
  }

  readConfig(): CodexConfig {
    return this.readTomlFile(this.configPath);
  }

  writeConfig(config: CodexConfig, createBackup: boolean = true): void {
    this.runExclusive(() => {
      if (createBackup) this.createBackup();
      this.atomicWriteUnlocked(this.configPath, TOML.stringify(config));
    });
  }

  patchConfig(patches: TomlPatch[], createBackup: boolean = true): void {
    this.runExclusive(() => {
      const original = fs.readFileSync(this.configPath, 'utf8');
      const updated = applyTomlPatches(original, patches);
      if (updated === original) return;
      try {
        if (updated.trim()) TOML.parse(updated);
      } catch (error) {
        throw new Error(`Refusing to write invalid TOML to ${this.configPath}: ${error}`);
      }
      if (createBackup) this.createBackup();
      this.atomicWriteUnlocked(this.configPath, updated);
    });
  }

  writeTextFileAtomic(filePath: string, content: string): void {
    this.runExclusive(() => this.atomicWriteUnlocked(filePath, content));
  }

  removeFile(filePath: string): boolean {
    return this.runExclusive(() => {
      if (!fs.existsSync(filePath)) return false;
      fs.unlinkSync(filePath);
      this.fsyncDirectory(path.dirname(filePath));
      return true;
    });
  }

  getBackupPath(): string { return this.backupPath; }
  getConfigPath(): string { return this.configPath; }
  getCodexHome(): string { return this.codexHome; }
  getProfilePath(): string { return path.join(this.codexHome, '1m.config.toml'); }
  getStatePath(): string { return path.join(this.codexHome, 'codex-1m-state.json'); }

  static getFixturesPath(): string {
    return path.join(__dirname, '..', 'fixtures');
  }
}
