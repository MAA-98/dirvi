import { basename, join } from 'node:path';
import { watch, type FSWatcher } from 'node:fs';
import { AppApi, createAppApis } from '../domain/app-api.js';
import { getUnixAbsPath } from './get-unix-abs-path.js';
import { getDirEntries } from './get-dir-entries.js';
import envPaths from 'env-paths';
import { createFileViewApi, StateCodec } from './create-file-view-api.js';
import { createHash } from 'node:crypto';
import {
  PosixCursorSchema,
  PosixFoldNode,
  PosixName,
  PosixNameSchema,
  PosixState, PosixStateRootSchema,
  PosixTreeNode,
  PosixTreeNodeSchema,
} from '../domain/posix-tree-node.js';
import { UnixAbsolutePath } from '../domain/unix-path.js';
import { z } from 'zod';

// ---*--- App Data ---*---

// Paths for app data:
const environmentPaths = envPaths('dirvi');
const posixAppDataDirectory = join(environmentPaths.data, 'apps', 'posix');
const posixAppViewsDirectory = join(posixAppDataDirectory, 'views');

// Helpers for saving app data:
function encodeKey(key: UnixAbsolutePath): string {
  return createHash('sha256').update(key).digest('hex');
}

// ---*--- Stored State Types and Schemas ---*---

export type StoredPosixFoldNode = {
  id: PosixName;
  children: StoredPosixFoldNode[];
  folds: PosixName[];
};

const StoredPosixFoldNodeSchema: z.ZodType<StoredPosixFoldNode> = z.lazy(() =>
  z.object({
    id: PosixNameSchema,
    children: z.array(StoredPosixFoldNodeSchema),
    folds: z.array(PosixNameSchema),
  }),
);

const StoredPosixStateSchema: z.ZodType<StoredPosixState> = z
  .object({
    root: PosixStateRootSchema,
    foldRoot: StoredPosixFoldNodeSchema,
    cursor: PosixCursorSchema,
  })
  .refine((state) => state.root.id !== state.foldRoot.id, {
    message: 'The fold root ID must match the tree root ID.',
  });

export type StoredPosixState = Omit<PosixState, 'foldRoot'> & {
  foldRoot: StoredPosixFoldNode;
};

// ---*--- Codec ---*---

function encodePosixFoldNode(node: PosixFoldNode): StoredPosixFoldNode {
  return {
    id: node.id,
    children: node.children.map(encodePosixFoldNode),
    folds: [...node.folds],
  };
}

function decodePosixFoldNode(node: StoredPosixFoldNode): PosixFoldNode {
  return {
    id: node.id,
    children: node.children.map(decodePosixFoldNode),
    folds: new Set(node.folds),
  };
}

const posixStateCodec: StateCodec<PosixState, StoredPosixState> = {
  schema: StoredPosixStateSchema,

  encode(state): StoredPosixState {
    return {
      root: state.root,
      foldRoot: encodePosixFoldNode(state.foldRoot),
      cursor: state.cursor,
    };
  },

  decode(state): PosixState {
    return {
      root: state.root,
      foldRoot: decodePosixFoldNode(state.foldRoot),
      cursor: state.cursor,
    };
  },
};

// --- Creating Posix App API ---

/**
 * Creates the AppApi for the POSIX app.
 *
 * @param directory - optional directory path for loading the app not at the cwd.
 */
export function loadPosixAppApi(
  directory?: string,
): AppApi<PosixName, PosixTreeNode, UnixAbsolutePath> {
  const unixAbsPath = getUnixAbsPath(directory ?? process.cwd());
  const rootId = PosixNameSchema.parse(basename(unixAbsPath));
  const apis = createAppApis<PosixName, PosixTreeNode>(rootId);

  return {
    appId: 'posix',
    name: unixAbsPath,
    emptyRootMessage: 'The directory is empty.',

    loadBranches: (path) => {
      const address = join(unixAbsPath, ...path);
      return getDirEntries(address);
    },
    createRoot: async () => {
      const address = join(unixAbsPath);
      const children = await getDirEntries(address);
      
      return {
        id: rootId,
        kind: 'directory',
        children
      }
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
