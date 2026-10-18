import { z } from 'zod';

import type {
  SerializableKey,
  TreeNode,
  TreeNodeApi,
} from 'dirvi-lib';

import { UnixPath, UnixPathSchema } from './unix-path.js';

// -----------------------------------------------------------------------------
// Utility
// -----------------------------------------------------------------------------

type Assert<True extends true> = True;

// -----------------------------------------------------------------------------
// PosixId: Id extends SerializableKey
// -----------------------------------------------------------------------------

/**
 * A JavaScript-string representation of a non-special POSIX filename.
 *
 * Validates invariants needed for a tree entry ID, not full POSIX compatibility.
 */
export const posixFilenameSchema = z.string()
    .min(1, 'Entry name cannot be empty.')
    .refine((value) => !value.includes('\0'), {
      message: 'Entry name must not contain a NUL character.',
    })
    .refine((value) => !value.includes('/'), {
      message: "Entry name must not contain '/'.",
    })
    .refine((value) => value !== '.' && value !== '..', {
      message: "Entry name must not be '.' or '..'.",
    });

/**
 * `Id` type used for posix-fs-dirvi-app.
 */
export type PosixId = z.output<typeof posixFilenameSchema>;

type PosixIdIsSerializableKey = Assert<
  PosixId extends SerializableKey ? true : false
>;

// -----------------------------------------------------------------------------
// PosixEntry: node-attached value
// -----------------------------------------------------------------------------

// Types -----------------------------------------------------------------------

/**
 * POSIX-specific meaning attached to a tree node.
 */
export type PosixValue =
  | Readonly<{
      kind: 'file';
    }>
  | Readonly<{
      kind: 'symlink';
      target: UnixPath;
    }>
  | Readonly<{
      kind: 'directory';
    }>;

export type PosixTreeNode = TreeNode<PosixId, PosixValue>;

// Schema ----------------------------------------------------------------------

const PosixFileEntrySchema = z
  .object({
    kind: z.literal('file'),
  })
  .strict();

const PosixSymlinkEntrySchema = z
  .object({
    kind: z.literal('symlink'),
    target: UnixPathSchema,
  })
  .strict();

const PosixDirectoryEntrySchema = z
  .object({
    kind: z.literal('directory'),
  })
  .strict();

export const posixValueSchema: z.ZodType<PosixValue> = z.discriminatedUnion(
  'kind',
  [PosixFileEntrySchema, PosixSymlinkEntrySchema, PosixDirectoryEntrySchema],
);

// -----------------------------------------------------------------------------
// POSIX domain constructors
// -----------------------------------------------------------------------------

export function createConstructors(
  posixTreeNodeApi: TreeNodeApi<PosixId, PosixValue>
) {
  return {
    file(name: PosixId): PosixTreeNode {
      return posixTreeNodeApi.createLeaf(name, {
        kind: 'file',
      });
    },
    
    symlink(name: PosixId, target: UnixPath): PosixTreeNode {
      return posixTreeNodeApi.createLeaf(name, {
        kind: 'symlink',
        target,
      });
    },
    
    unloadedDirectory(name: PosixId): PosixTreeNode {
      return posixTreeNodeApi.createUnloadedBranch(name, {
        kind: 'directory',
      });
    },
    
    loadedDirectory(
      name: PosixId,
      children: Iterable<PosixTreeNode>,
    ): PosixTreeNode | undefined {
      return posixTreeNodeApi.createLoadedBranch(
        name,
        { kind: 'directory' },
        children,
      );
    },
    
    /**
     * Runtime domain invariant check.
     *
     * A file and symlink must be leaves. A directory must be a branch, whether
     * loaded or unloaded.
     */
    isValid(node: PosixTreeNode): boolean {
      const entry = posixTreeNodeApi.value(node);
      const treeKind = posixTreeNodeApi.kind(node);
      
      switch (entry.kind) {
        case 'file':
        case 'symlink':
          return treeKind === 'leaf';
        
        case 'directory':
          return treeKind === 'unloaded-branch' || treeKind === 'loaded-branch';
      }
    },
    
    /**
     * Adds or replaces the loaded children of a directory.
     *
     * Returns `undefined` when:
     * - the supplied node is not a directory; or
     * - siblings have duplicate names.
     */
    withLoadedChildren(
      node: PosixTreeNode,
      children: Iterable<PosixTreeNode>,
    ): PosixTreeNode | undefined {
      if (posixTreeNodeApi.value(node).kind !== 'directory') {
        return undefined;
      }
      
      return posixTreeNodeApi.withLoadedChildren(node, children);
    },
    
    /**
     * Converts a directory to an unloaded directory.
     *
     * Files and symlinks cannot be converted to branches through this POSIX API.
     */
    toUnloadedDirectory(node: PosixTreeNode): PosixTreeNode | undefined {
      if (posixTreeNodeApi.value(node).kind !== 'directory') {
        return undefined;
      }
      
      return posixTreeNodeApi.toUnloadedBranch(node);
    },
  } as const
};

// -----------------------------------------------------------------------------
// Serializable POSIX model
// -----------------------------------------------------------------------------

// /**
//  * This is a DTO / persistence shape, not the runtime domain type.
//  *
//  * It intentionally exposes `id`, `value`, and `children`, because serialized
//  * data must have a concrete public format.
//  */
// export type PosixTreeNodeModel = TreeNodeModel<PosixId, PosixValue>;
//
// /**
//  * Validates both the generic tree model shape and the POSIX-specific
//  * file/symlink/directory invariants.
//  *
//  * Files and symlinks must be leaf models.
//  * Directories must be unloaded or loaded branch models.
//  */
// export const PosixTreeNodeModelSchema: z.ZodType<PosixTreeNodeModel> = z.lazy(
//   () =>
//     z.union([
//       // Leaf: file
//       z
//         .object({
//           id: posixFilenameSchema,
//           value: PosixFileEntrySchema,
//         })
//         .strict(),
//
//       // Leaf: symlink
//       z
//         .object({
//           id: posixFilenameSchema,
//           value: PosixSymlinkEntrySchema,
//         })
//         .strict(),
//
//       // Unloaded branch: directory
//       z
//         .object({
//           id: posixFilenameSchema,
//           value: PosixDirectoryEntrySchema,
//           children: z.null(),
//         })
//         .strict(),
//
//       // Loaded branch: directory
//       z
//         .object({
//           id: posixFilenameSchema,
//           value: PosixDirectoryEntrySchema,
//           children: z.array(PosixTreeNodeModelSchema),
//         })
//         .strict(),
//     ]),
// );

// /**
//  * Decodes validated external data into the opaque domain type.
//  *
//  * `fromModel` additionally checks sibling-name uniqueness. That validation is
//  * separate from Zod's object-shape validation.
//  */
// export function decodePosixTreeNode(input: unknown): PosixTreeNode | undefined {
//   const model = PosixTreeNodeModelSchema.safeParse(input);
//
//   if (!model.success) {
//     return undefined;
//   }
//
//   const node = PosixTreeNodeApi.fromModel(model.data);
//
//   if (node === undefined) {
//     return undefined;
//   }
//
//   return PosixTreeNode.isValid(node) ? node : undefined;
// }
//
// export function encodePosixTreeNode(node: PosixTreeNode): PosixTreeNodeModel {
//   return PosixTreeNodeApi.toModel(node);
// }

// // -----------------------------------------------------------------------------
// // PosixFolds
// // -----------------------------------------------------------------------------
//
// export type PosixFoldsModel = FoldsModel<PosixId>;
//
// export const PosixFoldsModelSchema: z.ZodType<PosixFoldsModel> =
//   createFoldsModelSchema(posixFilenameSchema);
//
// // -----------------------------------------------------------------------------
// // PosixCursor
// // -----------------------------------------------------------------------------
//
// export const PosixCursorSchema: z.ZodType<PosixCursor> =
//   createCursorSchema(posixFilenameSchema);
//
// export type PosixCursor = Cursor<PosixId>;
//
// // -----------------------------------------------------------------------------
// // PosixState
// // -----------------------------------------------------------------------------
//
// export type PosixStateModel = StateModel<PosixId, PosixValue>;
//
// /**
//  * The state schema should operate on a serializable tree *model*, then decode
//  * it to opaque nodes. Do not try to make Zod construct TreeNode directly.
//  */
// export const PosixStateModelSchema: z.ZodType<PosixStateModel> =
//   createStateModelSchema(
//     posixTreeNodeModelSchema,
//     PosixFoldsModelSchema,
//     PosixCursorSchema,
//   );
