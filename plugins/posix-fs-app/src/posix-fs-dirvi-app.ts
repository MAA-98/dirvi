import type { AppDefinition, AppPlugin, AppPlugin2 } from 'dirvi-apis/plugin';

import { createFsResyncSubscription, loadNodePosixAppApi } from './infrastructure/load-node-posix-app-api.js';
import { PosixValue, PosixFilenameSchema, PosixId, PosixValueSchema, PosixTreeNode } from './domain/posix-tree.js';
import { basename, join } from 'node:path';
import { getUnixAbsPath } from './infrastructure/get-unix-abs-path.js';
import { getDirEntries } from './infrastructure/get-dir-entries.js';

/**
 * A dirvi app that exposes a POSIX filesystem as a navigable tree.
 */
export const posixAppPlugin: AppPlugin = {
  createAppApiApplicator: (input) => {
    const appApi = loadNodePosixAppApi(input);

    return (appApiConsumer) => {
      return appApiConsumer(appApi);
    };
  },
};

/**
 * Creates applicator of AppDefinition.
 *
 * Input for this app is the absolute path to the directory to open on.
 */
export const posixAppPlugin2: AppPlugin2 = {
  createAppDefinitionApplicator: (input) => {
    const unixAbsPath = getUnixAbsPath(input ?? process.cwd());
    const rootId = PosixFilenameSchema.parse(basename(unixAbsPath));
    function loadDirectoryEntries(path: readonly PosixId[]) {
      const address = join(unixAbsPath, ...path);
      return getDirEntries(address);
    }
    
    const appDefinition = {
      displayName: `POSIX: ${input}`,
      rootId,
      idSchema: PosixFilenameSchema,
      valueSchema: PosixValueSchema,
      createRoot: async () => {
        // Start with root branches already loaded
        const rootBranches = await loadDirectoryEntries([]);
        const root = PosixTreeNode.loadedDirectory(rootId, rootBranches);

        if (root === undefined) {
          throw new Error(
            'Cannot create POSIX root: duplicate directory entry names',
          );
        }

        return root;
      },
      loadChildren: loadDirectoryEntries,
      subscribeToResync: createFsResyncSubscription(join(unixAbsPath)),
      createNavNodeApiOptions: {
        compareSiblings: (
          left: Readonly<{
            id: PosixId;
            value: PosixValue;
          }>,
          right: Readonly<{
            id: PosixId;
            value: PosixValue;
          }>,
        ) => {
          return left.id.localeCompare(right.id);
        },
      },
    };

    return (appDefinitionConsumer) => {
      return appDefinitionConsumer(appDefinition);
    };
  },
};
