import type { FSWatcher } from 'node:fs';
import { mkdirSync, watch } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import envPaths from 'env-paths';

import type { Config } from '../domain/config.js';
import { ConfigSchema, defaultConfig } from '../domain/config.js';
import type { ConfigApi } from '../application/config-api.js';

const environmentPaths = envPaths('dirvi');
const configDirectory = environmentPaths.config;
const configPath = join(configDirectory, 'config.json');

export function loadNodeConfigApi(): ConfigApi {
  // Ensure the directory exists before a watcher is created.
  mkdirSync(configDirectory, { recursive: true });

  return {
    load: loadConfigFile,
    save: saveConfigFile,
    subscribeToResync: createConfigResyncSubscription(),
  };
}

async function loadConfigFile(): Promise<Config> {
  try {
    const contents = await readFile(configPath, 'utf8');
    const parsed: unknown = JSON.parse(contents);

    return ConfigSchema.parse(parsed);
  } catch (error: unknown) {
    if (isFileNotFoundError(error)) {
      return defaultConfig;
    }

    throw new Error(
      `Unable to load configuration: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function saveConfigFile(config: Config): Promise<void> {
  const validatedConfig = ConfigSchema.parse(config);
  const temporaryConfigPath = `${configPath}.tmp`;

  await writeFile(
    temporaryConfigPath,
    `${JSON.stringify(validatedConfig, null, 2)}\n`,
    'utf8',
  );

  // Atomic replacement also means the watcher should watch the directory,
  // rather than only the config file.
  await rename(temporaryConfigPath, configPath);
}

function createConfigResyncSubscription(): (
  listener: () => void,
) => () => void {
  const listeners = new Set<() => void>();
  const configFileName = basename(configPath);

  let watcher: FSWatcher | undefined;
  let notificationTimer: ReturnType<typeof setTimeout> | undefined;

  function notifyListeners(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function scheduleNotification(): void {
    if (notificationTimer !== undefined) {
      clearTimeout(notificationTimer);
    }

    notificationTimer = setTimeout(() => {
      notificationTimer = undefined;

      if (listeners.size > 0) {
        notifyListeners();
      }
    }, 100);
  }

  function startWatcher(): void {
    if (watcher !== undefined) {
      return;
    }

    watcher = watch(configDirectory, (_eventType, filename) => {
      const changedFileName = filename?.toString();

      if (changedFileName === undefined || changedFileName === configFileName) {
        scheduleNotification();
      }
    });

    watcher.on('error', () => {
      // The next load() call will report the relevant error.
    });
  }

  function stopWatcher(): void {
    if (notificationTimer !== undefined) {
      clearTimeout(notificationTimer);
      notificationTimer = undefined;
    }

    watcher?.close();
    watcher = undefined;
  }

  return (listener) => {
    listeners.add(listener);
    startWatcher();

    let subscribed = true;

    return () => {
      if (!subscribed) {
        return;
      }

      subscribed = false;
      listeners.delete(listener);

      if (listeners.size === 0) {
        stopWatcher();
      }
    };
  };
}

function isFileNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}
