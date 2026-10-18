import { watch, type FSWatcher } from 'node:fs';
import { basename, dirname } from 'node:path';

export function createXmlFileResyncSubscription(
  xmlAbsolutePath: string,
): (listener: () => void) => () => void {
  const listeners = new Set<() => void>();

  const parentDirectory = dirname(xmlAbsolutePath);
  const fileName = basename(xmlAbsolutePath);

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

    watcher = watch(parentDirectory, (_eventType, changedName) => {
      /*
       * A null filename means the platform could not identify the changed
       * entry. Conservatively resync in that case.
       */
      if (changedName === null || changedName.toString() === fileName) {
        scheduleNotification();
      }
    });

    watcher.on('error', () => {
      /*
       * The next createRoot() call will report the filesystem or XML parsing
       * failure through normal application error handling.
       */
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
