import { readdir, readlink } from 'node:fs/promises';
import { join } from 'node:path';

import type { AppChild } from 'dirvi-apis';

import {
  type PosixId,
  type PosixValue,
  posixFilenameSchema,
} from '../domain/posix-tree.js';
import { type UnixAbsolutePath, UnixPathSchema } from '../domain/unix-path.js';

export async function getDirEntries(
  address: UnixAbsolutePath,
): Promise<readonly AppChild<PosixId, PosixValue>[]> {
  const directoryEntries = await readdir(address, {
    withFileTypes: true,
  });

  return Promise.all(
    directoryEntries.map(
      async (entry): Promise<AppChild<PosixId, PosixValue>> => {
        const id = posixFilenameSchema.parse(entry.name);

        if (entry.isSymbolicLink()) {
          const target = UnixPathSchema.parse(
            await readlink(join(address, entry.name)),
          );

          return { id, kind: 'leaf', value: { kind: 'symlink', target } };
        }

        if (entry.isDirectory()) {
          return {
            id,
            kind: 'unloaded-branch',
            value: { kind: 'directory' },
          };
        }

        if (entry.isFile()) {
          return { id, kind: 'leaf', value: { kind: 'file' } };
        }

        throw new Error(
          `Unsupported filesystem entry "${join(address, entry.name)}"`,
        );
      },
    ),
  );
}
