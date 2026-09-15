import { join } from 'node:path';
import { watch, type FSWatcher } from 'node:fs';
import { AppApi, createAppApis } from '../domain/app-api.js';
import { getUnixAbsPath } from './get-unix-abs-path.js';
import { getDirEntries } from './get-dir-entries.js';
import envPaths from 'env-paths';
import { createFileViewApi, StateCodec } from './create-file-view-api.js';
import { createHash } from 'node:crypto';
import {
  PosixCursorSchema, PosixFoldNode, PosixFoldNodeRoot,
  PosixName,
  PosixNameSchema,
  PosixState,
  PosixTreeNode,
  PosixTreeNodeSchema,
} from '../domain/posix-tree-node.js';
import { UnixAbsolutePath } from '../domain/unix-path.js';
import { z } from 'zod';

// ---*--- App Data ---*---

// Paths for app data:
const paths = envPaths('dirvi');
const posixAppDataDirectory = join(
  paths.data,
  'apps',
  'posix',
);
const posixAppViewsDirectory = join(
  posixAppDataDirectory,
  'views',
);

// Helpers for saving app data:
// The key for the Posix app instance is just the directory working in.
function encodeKey(key: UnixAbsolutePath): string {
  return createHash('sha256')
    .update(key)
    .digest('hex');
}

// ---*--- Stored State Types and Schemas ---*---

export type StoredPosixFoldNode = {
  id: PosixName;
  children: StoredPosixFoldNode[];
  folds: PosixName[];
};

export type StoredPosixFoldNodeRoot = {
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

const StoredPosixFoldNodeRootSchema: z.ZodType<StoredPosixFoldNodeRoot> =
  z.object({
    children: z.array(StoredPosixFoldNodeSchema),
    folds: z.array(PosixNameSchema),
  });

const StoredPosixStateSchema: z.ZodType<StoredPosixState> = z.object({
  buffer: z.array(PosixTreeNodeSchema),
  foldNode: StoredPosixFoldNodeRootSchema,
  cursor: PosixCursorSchema,
});

export type StoredPosixState = Omit<PosixState, 'foldNode'> & {
  foldNode: StoredPosixFoldNodeRoot;
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

function encodePosixFoldNodeRoot(
  root: PosixFoldNodeRoot,
): StoredPosixFoldNodeRoot {
  return {
    children: root.children.map(encodePosixFoldNode),
    folds: [...root.folds],
  };
}

function decodePosixFoldNodeRoot(
  root: StoredPosixFoldNodeRoot,
): PosixFoldNodeRoot {
  return {
    children: root.children.map(decodePosixFoldNode),
    folds: new Set(root.folds),
  };
}

const posixStateCodec: StateCodec<PosixState, StoredPosixState> = {
  schema: StoredPosixStateSchema,

  encode(state): StoredPosixState {
    return {
      buffer: state.buffer,
      foldNode: encodePosixFoldNodeRoot(state.foldNode),
      cursor: state.cursor,
    };
  },

  decode(state): PosixState {
    return {
      buffer: state.buffer,
      foldNode: decodePosixFoldNodeRoot(state.foldNode),
      cursor: state.cursor,
    };
  },
};

// --- Creating Posix App API ---
export function loadPosixAppApi(
  directory?: string,
): AppApi<PosixName, PosixTreeNode, UnixAbsolutePath> {
  const unixAbsPath = getUnixAbsPath(directory ?? process.cwd());
  const apis = createAppApis<PosixName, PosixTreeNode>();

  return {
    appId: 'posix',
    name: `Posix(${unixAbsPath})`,
    emptyForestMessage: 'The directory is empty.',

    loadBranches: (path) => {
      const address = join(unixAbsPath, ...path);
      return getDirEntries(address);
    },

    subscribeToResync: createFsResyncSubscription(join(unixAbsPath)),

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
