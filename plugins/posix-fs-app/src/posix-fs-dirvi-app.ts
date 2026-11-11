import { basename, join } from 'node:path';

import type { CreateAppDefinitionApplicator, NodeKind } from 'dirvi-apis';

import type { PosixValue, PosixId } from './domain/posix-tree.js';
import { posixFilenameSchema, posixValueSchema } from './domain/posix-tree.js';
import { createFsResyncSubscription } from './infrastructure/load-node-posix-app-api.js';
import { getUnixAbsPath } from './infrastructure/get-unix-abs-path.js';
import { getDirEntries } from './infrastructure/get-dir-entries.js';

/**
 * Creates applicator of AppDefinition.
 *
 * Input for this app is the absolute path to the directory to open on.
 */
export const posixApp: CreateAppDefinitionApplicator = (input) => {
  const unixAbsPath = getUnixAbsPath(input ?? process.cwd());
  const rootId = posixFilenameSchema.parse(basename(unixAbsPath));
  function loadDirectoryEntries(path: readonly PosixId[]) {
    const address = join(unixAbsPath, ...path);
    return getDirEntries(address);
  }

  const appDefinition = {
    semanticOrder: false,
    valueSchema: posixValueSchema,
    loadChildren: (path: readonly PosixId[]) => loadDirectoryEntries(path),
    loadRoot: async () => ({
      id: rootId,
      value: { kind: 'directory' as const },
    }),
    presentNode: (id: PosixId, value: PosixValue, nodeKind: NodeKind) => {
      if (value.kind === 'file') {
        const filenameHighlightToken = {
          content: id,
          highlight: 'file.name',
        };

        if (id.endsWith('.ts')) {
          return [
            {
              content: '\ue8ca ',
              highlight: 'icon.typescript',
            },
            filenameHighlightToken,
          ];
        }
        if (id.endsWith('.tsx')) {
          return [
            {
              content: '\ue7ba ',
              highlight: 'icon.typescript',
            },
            filenameHighlightToken,
          ];
        }
        if (id.endsWith('.js')) {
          return [
            {
              content: '\ue781 ',
              highlight: 'icon.javascript',
            },
            filenameHighlightToken,
          ];
        }
        if (id.endsWith('.tsx')) {
          return [
            {
              content: '\ue7ba ',
              highlight: 'icon.javascript',
            },
            filenameHighlightToken,
          ];
        }
      }
      if (value.kind === 'directory') {
        return [
          {
            content: '\uf07b ',
            highlight: 'icon.folder',
          },
          {
            content: id + '/',
            highlight: 'foldername',
          },
        ];
      }
      return [
        {
          content: id,
          highlight: nodeKind,
        },
      ];
    },
    subscribeToResync: createFsResyncSubscription(join(unixAbsPath)),
  };

  return (appDefinitionConsumer) => {
    return appDefinitionConsumer(appDefinition);
  };
};
