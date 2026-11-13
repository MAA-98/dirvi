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
export const app: CreateAppDefinitionApplicator = (input) => {
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
          highlight: 'content',
        };

        if (['.ts', '.mts', '.cts'].some((suffix) => id.endsWith(suffix))) {
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

        if (['.js', '.mjs', '.cjs'].some((suffix) => id.endsWith(suffix))) {
          return [
            {
              content: '\udb80\udf1e ',
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

        if (id.endsWith('.json')) {
          return [
            {
              content: '\udb80\udd69 ',
              highlight: 'icon.json',
            },
            filenameHighlightToken,
          ];
        }

        if (id.endsWith('.md')) {
          return [
            {
              content: '\uf48a ',
              highlight: 'content',
            },
            filenameHighlightToken,
          ];
        }

        if (id.endsWith('.svg')) {
          return [
            {
              content: '\udb81\udf21 ',
              highlight: 'icon.svg',
            },
            filenameHighlightToken,
          ];
        }

        if (id === '.DS_Store') {
          return [
            {
              content: '\ue711 ',
              highlight: 'content',
            },
            filenameHighlightToken,
          ];
        }

        if (id === '.gitignore') {
          return [
            {
              content: '\udb80\udea2 ',
              highlight: 'icon.git',
            },
            filenameHighlightToken,
          ];
        }

        return [
          {
            content: '  ' + id,
            highlight: 'file.name',
          },
        ];
      }
      if (value.kind === 'directory') {
        const foldernameHighlightToken = {
          content: id + '/',
          highlight: 'content',
        };

        if (id === '.git') {
          return [
            {
              content: '\udb80\udea2 ',
              highlight: 'icon.git',
            },
            foldernameHighlightToken,
          ];
        }

        return [
          {
            content: '\uf07b ',
            highlight: 'icon.folder',
          },
          foldernameHighlightToken,
        ];
      }
      return [
        {
          content: '  ' + id,
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
