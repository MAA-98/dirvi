import { readdir, readlink } from 'node:fs/promises';
import { join } from 'node:path';

import type { UnixAbsolutePath, PosixNode } from 'dirvi-lib';
import { UnixPathSchema, PosixNameSchema } from 'dirvi-lib';

export async function getDirEntries(
  address: UnixAbsolutePath,
): Promise<PosixNode[]> {
  const directoryEntries = await readdir(address, {
    withFileTypes: true,
  });

  return Promise.all(
    directoryEntries.map(async (directoryEntry): Promise<PosixNode> => {
      const name = PosixNameSchema.parse(directoryEntry.name);

      if (directoryEntry.isSymbolicLink()) {
        const target = UnixPathSchema.parse(
          await readlink(join(address, directoryEntry.name)),
        );

        return {
          kind: 'symlink',
          name,
          target,
        };
      }

      if (directoryEntry.isDirectory()) {
        return {
          kind: 'directory',
          name,
          branches: null, // Directory not expanded.
        };
      }

      if (directoryEntry.isFile()) {
        return {
          kind: 'file',
          name,
        };
      }

      throw new Error(
        `Unsupported filesystem entry "${join(address, directoryEntry.name)}"`,
      );
    }),
  );
}
