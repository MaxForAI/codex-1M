#!/usr/bin/env node

import { formatInstallResult, formatUninstallResult, installCodex1M, uninstallCodex1M } from './installer';

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    if (argv.length === 0) {
      console.log(formatInstallResult(installCodex1M()));
      return 0;
    }
    if (argv.length === 1 && argv[0] === 'uninstall') {
      console.log(formatUninstallResult(uninstallCodex1M()));
      return 0;
    }
    console.error('Usage: codex-1m [uninstall]');
    return 1;
  } catch (error) {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (require.main === module) {
  void runCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
