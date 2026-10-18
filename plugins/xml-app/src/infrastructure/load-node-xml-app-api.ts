import { watch, type FSWatcher } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

import type { AppApi } from 'dirvi-apis';
import { createAppStateApis } from 'dirvi-lib';

import {
  type Position,
  type XmlNodeValue,
  xmlFoldsApi,
  xmlNavApi,
} from '../domain/xml-tree.js';
import { readFile } from 'node:fs/promises';
import { parseXmlDocument } from './parse-xml-document.js';

/**
 * Creates the AppApi for one XML document.
 *
 * XML is parsed eagerly as one complete tree. Child order is retained by the
 * XML domain tree and displayed through xmlNavApi's source-order navigation.
 */
export function loadNodeXmlAppApi(
  filePath: string,
): AppApi<Position, XmlNodeValue, string> {
  const xmlAbsolutePath = resolve(filePath);
  const apis = createAppStateApis<Position, XmlNodeValue>();

  return {
    name: basename(xmlAbsolutePath),

    /*
     * parseXmlDocument() reserves position 0 for the synthetic document root.
     */
    rootId: 0,

    createRoot: async () => {
      const source = await readFile(xmlAbsolutePath, 'utf8');
      return parseXmlDocument(source);
    },

    /*
     * XML documents are parsed completely when their root is created. No XML
     * branch is represented as an unloaded branch.
     */
    async loadBranches() {
      throw new Error(
        'Cannot load XML branches: parsed XML documents have no unloaded branches.',
      );
    },

    /*
     * Watch the parent directory rather than the file directly. Editors often
     * save atomically by replacing the document file with a renamed temporary
     * file, which can invalidate a direct file watcher.
     */
    subscribeToResync: createXmlFileResyncSubscription(xmlAbsolutePath),

    /*
     * The absolute filename identifies this app instance. View persistence is
     * intentionally not wired yet.
     */
    // viewKey: xmlAbsolutePath,

    foldsApi: xmlFoldsApi,
    navNodeApi: xmlNavApi,

    ...apis,
  };
}

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
