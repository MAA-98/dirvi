import { access, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  createConfigRuntime,
  type DirviConfigApi,
} from '../application/config-runtime.js';
import type { Config } from '../domain/config.js';

const configHome =
  process.env.XDG_CONFIG_HOME?.trim() || join(homedir(), '.config');
const configDirectory = join(configHome, 'dirvi');
const configPath = join(configDirectory, 'init.mjs');

export async function loadNodeConfig(): Promise<Config> {
  await mkdir(configDirectory, { recursive: true });

  if (!(await configFileExists())) {
    return createConfigRuntime().finish();
  }

  const runtime = createConfigRuntime();
  const previousDirvi = Object.getOwnPropertyDescriptor(globalThis, 'dirvi');

  Object.defineProperty(globalThis, 'dirvi', {
    configurable: true,
    value: runtime.api,
    writable: false,
  });

  try {
    await import(pathToFileURL(configPath).href);

    return runtime.finish();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(
      `Unable to evaluate configuration at ${configPath}: ${message}`,
    );
  } finally {
    restoreGlobalDirvi(previousDirvi);
  }
}

async function configFileExists(): Promise<boolean> {
  try {
    await access(configPath);
    return true;
  } catch (error: unknown) {
    if (isFileNotFoundError(error)) {
      return false;
    }

    throw error;
  }
}

function restoreGlobalDirvi(
  previousDirvi: PropertyDescriptor | undefined,
): void {
  if (previousDirvi === undefined) {
    delete (globalThis as { dirvi?: DirviConfigApi }).dirvi;
    return;
  }

  Object.defineProperty(globalThis, 'dirvi', previousDirvi);
}

function isFileNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}
