import { basename, join } from 'node:path';
import { watch, type FSWatcher } from 'node:fs';
import { getUnixAbsPath } from './get-unix-abs-path.js';
import { getDirEntries } from './get-dir-entries.js';
import envPaths from 'env-paths';
import { createFileViewApi, StateCodec } from './create-file-view-api.js';
import { createHash } from 'node:crypto';
import {
  PosixBranchTreeNodeSchema,
  PosixCursorSchema,
  PosixFoldNode,
  PosixName,
  PosixNameSchema,
  PosixState,
  PosixTreeNode,
} from '../domain/posix-tree-node.js';
import { UnixAbsolutePath } from '../domain/unix-path.js';
import { z } from 'zod';
import { AppApi, createAppStateApis } from 'dirvi-lib';

// ---*--- App Data ---*---

// Paths for app data:
const environmentPaths = envPaths('dirvi');
const posixAppDataDirectory = join(environmentPaths.data, 'apps', 'posix');
const posixAppViewsDirectory = join(posixAppDataDirectory, 'views');

// Helpers for saving app data:
function encodeKey(key: UnixAbsolutePath): string {
  return createHash('sha256').update(key).digest('hex');
}

// --- Creating Posix App API ---

/**
 * Creates the AppApi for the POSIX app.
 *
 * @param directory - optional directory path for loading the app not at the cwd.
 */
export function loadNodePosixAppApi(
  directory?: string,
): AppApi<PosixName, PosixTreeNode, UnixAbsolutePath> {
  const unixAbsPath = getUnixAbsPath(directory ?? process.cwd());
  const rootId = PosixNameSchema.parse(basename(unixAbsPath));
  const apis = createAppStateApis<PosixName, PosixTreeNode>();

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

      return {
        id: rootId,
        kind: 'directory',
        children: rootBranches,
      };
    },

    subscribeToResync: createFsResyncSubscription(join(unixAbsPath)),

    // The key for the Posix app instance is just the directory working in:
    viewKey: unixAbsPath,
    viewApi: createFileViewApi({
      directory: posixAppViewsDirectory,
      encodeKey,
      stateCodec: posixStateCodec,
    }),

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

// ---*--- Stored State Types and Schemas ---*---

// export type StoredPosixFoldNode = {
//   id: PosixName;
//   children: StoredPosixFoldNode[];
//   foldedChildren: StoredPosixFoldNode[];
// };
//
// const StoredPosixFoldNodeSchema: z.ZodType<StoredPosixFoldNode> = z.lazy(() =>
//   z.object({
//     id: PosixNameSchema,
//     children: z.array(StoredPosixFoldNodeSchema),
//     foldedChildren: z.array(StoredPosixFoldNodeSchema),
//   }),
// );
//
// const StoredPosixStateSchema: z.ZodType<StoredPosixState> = z
//   .object({
//     root: PosixBranchTreeNodeSchema,
//     foldRoot: StoredPosixFoldNodeSchema,
//     cursor: PosixCursorSchema,
//   })
//   .refine((state) => state.root.id !== state.foldRoot.id, {
//     message: 'The fold root ID must match the tree root ID.',
//   });
//
// export type StoredPosixState = Omit<PosixState, 'foldRoot'> & {
//   foldRoot: StoredPosixFoldNode;
// };

// ---*--- Codec ---*---

// function encodePosixFoldNode(node: PosixFoldNode): StoredPosixFoldNode {
//   return {
//     id: node.id,
//     children: node.children.map(encodePosixFoldNode),
//     foldedChildren: [...node.foldedChildren],
//   };
// }
//
// function decodePosixFoldNode(node: StoredPosixFoldNode): PosixFoldNode {
//   return {
//     id: node.id,
//     children: node.children.map(decodePosixFoldNode),
//     foldedChildren: node.foldedChildren.map(decodePosixFoldNode),
//   };
// }
//
// const posixStateCodec: StateCodec<PosixState, StoredPosixState> = {
//   schema: StoredPosixStateSchema,
//
//   encode(state): StoredPosixState {
//     return {
//       root: state.root,
//       foldRoot: encodePosixFoldNode(state.foldRoot),
//       cursor: state.cursor,
//     };
//   },
//
//   decode(state): PosixState {
//     return {
//       root: state.root,
//       foldRoot: decodePosixFoldNode(state.foldRoot),
//       cursor: state.cursor,
//     };
//   },
// };