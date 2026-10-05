import { TreeNode, TreeNodeApi } from 'dirvi-lib';
import {
  PosixEntry,
  PosixName,
  PosixNameSchema,
  PosixTreeNode,
} from '../domain/posix-tree-node.js';
import { UnixAbsolutePath, UnixPathSchema } from '../domain/unix-path.js';
import { readdir, readlink } from 'node:fs/promises';
import { join } from 'node:path';

export async function getDirEntries(
  address: UnixAbsolutePath,
): Promise<TreeNode<PosixName, PosixEntry>[]> {
  const directoryEntries = await readdir(address, {
    withFileTypes: true,
  });

  return Promise.all(
    directoryEntries.map(async (directoryEntry): Promise<PosixTreeNode> => {
      const id = PosixNameSchema.parse(directoryEntry.name);

      if (directoryEntry.isSymbolicLink()) {
        const target = UnixPathSchema.parse(
          await readlink(join(address, directoryEntry.name)),
        );

        return PosixTreeNode.symlink(id, target);
      }

      if (directoryEntry.isDirectory()) {
        return PosixTreeNode.unloadedDirectory(id);
      }

      if (directoryEntry.isFile()) {
        return PosixTreeNode.file(id);
      }

      throw new Error(
        `Unsupported filesystem entry "${join(address, directoryEntry.name)}"`,
      );
    }),
  );
}
