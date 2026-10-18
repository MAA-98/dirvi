import { basename, join } from 'node:path';

import type { AppPlugin } from 'dirvi-apis';
import type { TreeNodeApi } from 'dirvi-lib';

import type { PosixValue, PosixId } from './domain/posix-tree.js';
import {
  posixFilenameSchema,
  posixValueSchema,
  createConstructors,
} from './domain/posix-tree.js';
import { createFsResyncSubscription } from './infrastructure/load-node-posix-app-api.js';
import { getUnixAbsPath } from './infrastructure/get-unix-abs-path.js';
import { getDirEntries } from './infrastructure/get-dir-entries.js';

/**
 * Creates applicator of AppDefinition.
 *
 * Input for this app is the absolute path to the directory to open on.
 */
export const posixAppPlugin: AppPlugin = {
  createAppDefinitionApplicator: (input) => {
    const unixAbsPath = getUnixAbsPath(input ?? process.cwd());
    const rootId = posixFilenameSchema.parse(basename(unixAbsPath));
    function loadDirectoryEntries(
      treeNodeApi: TreeNodeApi<PosixId, PosixValue>,
      path: readonly PosixId[]
    ) {
      const address = join(unixAbsPath, ...path);
      return getDirEntries(treeNodeApi, address);
    }
    
    const appDefinition = {
      displayName: `POSIX: ${input}`,
      rootId,
      idSchema: posixFilenameSchema,
      valueSchema: posixValueSchema,
      createRoot: async (treeNodeApi: TreeNodeApi<PosixId, PosixValue>) => {
        // Start with root branches already loaded
        const rootBranches = await loadDirectoryEntries(treeNodeApi, []);
        const root = createConstructors(treeNodeApi).loadedDirectory(rootId, rootBranches);

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
