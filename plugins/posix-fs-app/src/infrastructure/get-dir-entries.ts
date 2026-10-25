import { readdir, readlink } from 'node:fs/promises';
import { join } from 'node:path';

import type { TreeNode, TreeMethods } from 'dirvi-lib';

import {
  type PosixValue,
  type PosixId,
  posixFilenameSchema,
  PosixTreeNode,
  createConstructors,
} from '../domain/posix-tree.js';
import { type UnixAbsolutePath, UnixPathSchema } from '../domain/unix-path.js';

export async function getDirEntries(
  treeNodeApi: TreeMethods<PosixId, PosixValue>,
  address: UnixAbsolutePath,
): Promise<TreeNode<PosixId, PosixValue>[]> {
  const directoryEntries = await readdir(address, {
    withFileTypes: true,
  });
  const constructors = createConstructors(treeNodeApi);

  return Promise.all(
    directoryEntries.map(async (directoryEntry): Promise<PosixTreeNode> => {
      const id = posixFilenameSchema.parse(directoryEntry.name);

      if (directoryEntry.isSymbolicLink()) {
        const target = UnixPathSchema.parse(
          await readlink(join(address, directoryEntry.name)),
        );

        return constructors.symlink(id, target);
      }

      if (directoryEntry.isDirectory()) {
        return constructors.unloadedDirectory(id);
      }

      if (directoryEntry.isFile()) {
        return constructors.file(id);
      }

      throw new Error(
        `Unsupported filesystem entry "${join(address, directoryEntry.name)}"`,
      );
    }),
  );
}
