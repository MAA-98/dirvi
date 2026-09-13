import { join } from 'node:path';
import { watch, type FSWatcher } from 'node:fs';
import { PosixName, PosixNode } from 'dirvi-lib';
import { AppApi, createAppApis } from '../domain/app-api.js';
import { getUnixAbsPath } from './get-unix-abs-path.js';
import { getDirEntries } from './get-dir-entries.js';

export function loadPosixAppApi(
  directory?: string,
): AppApi<PosixName, PosixNode> {
  const unixAbsPath = getUnixAbsPath(directory ?? process.cwd());
  const apis = createAppApis<PosixName, PosixNode>();
  const subscribeToResync = createFsResyncSubscription(join(unixAbsPath));

  return {
    name: `Posix(${unixAbsPath})`,
    emptyForestMessage: 'The directory is empty.',

    loadBranches: (path) => {
      const address = join(unixAbsPath, ...path);
      return getDirEntries(address);
    },

    subscribeToResync,

    ...apis,
  };
}

// `recursive: true` is supported by macOS and Windows, but
// recursive watching is not supported on all Node/POSIX
// platforms: Linux unsupported.
function createFsResyncSubscription(
  directory: string,
): (listener: () => void) => () => void {
  const listeners = new Set<() => void>();

  let watcher: FSWatcher | undefined;
  let notificationTimer: ReturnType<typeof setTimeout> | undefined;

  function notifyListeners() {
    for (const listener of listeners) {
      listener();
    }
  }

  function scheduleNotification() {
    // fs.watch can emit several events for one filesystem operation.
    // Debounce them into a single resync request.
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

  function startWatcher() {
    if (watcher !== undefined) {
      return;
    }

    watcher = watch(
      directory,
      {
        recursive: true,
      },
      (_eventType, _filename) => {
        scheduleNotification();
      },
    );

    watcher.on('error', () => {
      // The next loadBranches call will report the relevant error.
    });
  }

  function stopWatcher() {
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
