import { basename, join } from 'node:path';
import { watch, type FSWatcher } from 'node:fs';
import { getUnixAbsPath } from './get-unix-abs-path.js';
import { getDirEntries } from './get-dir-entries.js';
import envPaths from 'env-paths';
import { createFileViewApi } from './create-file-view-api.js';
import type { StateCodec } from './create-file-view-api.js';
import { createHash } from 'node:crypto';
import {
  PosixCursorApi,
  PosixEntry,
  PosixFoldsApi,
  PosixName,
  PosixNameSchema,
  PosixNavApi,
  PosixState,
  PosixStateModel,
  PosixStateModelSchema,
  PosixTreeNode,
  PosixTreeNodeApi,
} from '../domain/posix-tree-node.js';
import { UnixAbsolutePath } from '../domain/unix-path.js';
import type { AppApi } from 'dirvi-lib';
import { createAppStateApis } from 'dirvi-lib';

// ---*--- App Data ---*---

// Paths for app data:
const environmentPaths = envPaths('dirvi');
const posixAppDataDirectory = join(environmentPaths.data, 'apps', 'posix');
const posixAppViewsDirectory = join(posixAppDataDirectory, 'views');

// Helpers for saving app data:
function encodeKey(key: UnixAbsolutePath): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Persists public POSIX state models while keeping TreeNode and Folds runtime
 * representations opaque.
 */
const posixStateCodec: StateCodec<PosixName, PosixEntry, PosixStateModel> = {
  schema: PosixStateModelSchema,
  encode: encodePosixState,
  decode: decodePosixState,
};

/**
 * Converts opaque POSIX runtime state into its serializable persistence model.
 */
function encodePosixState(state: PosixState): PosixStateModel {
  return {
    root: PosixTreeNodeApi.toModel(state.root),
    folds: PosixFoldsApi.toModel(state.folds),
    cursor: PosixCursorApi.getPath(state.cursor),
  };
}

/**
 * Restores opaque POSIX runtime state from a schema-validated model.
 *
 * `TreeNodeApi.fromModel` performs the structural sibling-ID uniqueness check
 * which cannot be fully expressed by the JSON/Zod model schema.
 */
function decodePosixState(model: PosixStateModel): PosixState | undefined {
  const root = PosixTreeNodeApi.fromModel(model.root);

  /*
   * State requires an open root branch. The POSIX domain additionally requires
   * files and symlinks to be leaves, and directories to be branches.
   */
  if (
    root === undefined ||
    !PosixTreeNode.isValid(root) ||
    PosixTreeNodeApi.kind(root) !== 'loaded-branch'
  ) {
    return undefined;
  }

  const folds = PosixFoldsApi.fromModel(model.folds);

  if (folds === undefined) {
    return undefined;
  }

  return {
    root,
    folds,
    cursor: PosixCursorApi.getPath(model.cursor),
  };
}

// --- Creating Posix App API ---

/**
 * Creates the AppApi for the POSIX app.
 *
 * @param directory - optional directory path for loading the app not at the cwd.
 */
export function loadNodePosixAppApi(
  directory?: string,
): AppApi<PosixName, PosixEntry, UnixAbsolutePath> {
  const unixAbsPath = getUnixAbsPath(directory ?? process.cwd());
  const rootId = PosixNameSchema.parse(basename(unixAbsPath));
  const apis = createAppStateApis<PosixName, PosixEntry>();

  function loadBranches(path: readonly PosixName[]) {
    const address = join(unixAbsPath, ...path);
    return getDirEntries(address);
  }

  return {
    appId: 'posix',
    name: unixAbsPath,
    rootId,
    loadBranches,
    createRoot: async () => {
      // Start with root branches already loaded
      const rootBranches = await loadBranches([]);
      const root = PosixTreeNode.loadedDirectory(rootId, rootBranches);

      if (root === undefined) {
        throw new Error(
          'Cannot create POSIX root: duplicate directory entry names',
        );
      }

      return root;
    },

    subscribeToResync: createFsResyncSubscription(join(unixAbsPath)),

    // The key for the Posix app instance is just the directory working in:
    viewKey: unixAbsPath,
    viewApi: createFileViewApi({
      directory: posixAppViewsDirectory,
      encodeKey,
      stateCodec: posixStateCodec,
    }),

    foldsApi: PosixFoldsApi,
    navNodeApi: PosixNavApi,
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
