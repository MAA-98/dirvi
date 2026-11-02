import { basename, join } from 'node:path';

import type { AppPlugin } from 'dirvi-apis';

import type { PosixValue, PosixId } from './domain/posix-tree.js';
import {
  posixFilenameSchema,
  posixValueSchema,
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
      path: readonly PosixId[],
    ) {
      const address = join(unixAbsPath, ...path);
      return getDirEntries(address);
    }
    
    const appDefinition = {
      displayName: `POSIX: ${input}`,
      semanticOrder: false,
      idSchema: posixFilenameSchema,
      valueSchema: posixValueSchema,
      loadChildren: (path: readonly PosixId[]) => loadDirectoryEntries(path),
      loadRoot: async () => ({
        id: rootId,
        value: { kind: 'directory' as const },
      }),
      presentNode: (id: PosixId, isBranch: boolean) => {
        return {
          content: id,
          highlight: isBranch ? 'directory' : 'leaf',
        };
      },
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
