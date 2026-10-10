import { z } from 'zod';
import {
  serializableKeySchema,
  createNavNodeApi,
  createStateApi,
  NavNode,
  SerializableKey,
  State,
  TreeNode,
  createTreeNodeApi,
  TreeNodeModel,
  Folds,
  createFoldsApi,
  FoldsModel,
  createFoldsModelSchema,
  createCursorSchema,
  Cursor,
  createCursorApi,
  createStateModelSchema,
  StateModel,
} from 'dirvi-lib';

import { UnixPath, UnixPathSchema } from './unix-path.js';

// -----------------------------------------------------------------------------
// Utility
// -----------------------------------------------------------------------------

type Assert<True extends true> = True;

// -----------------------------------------------------------------------------
// PosixName
// -----------------------------------------------------------------------------

export const PosixNameSchema = serializableKeySchema.pipe(
  z
    .string()
    .min(1, 'Entry name cannot be empty.')
    .refine((value) => !value.includes('/'), {
      message: "Entry name must not contain '/'.",
    })
    .refine((value) => value !== '.' && value !== '..', {
      message: "Entry name cannot be '.' or '..'.",
    }),
);

export type PosixName = z.output<typeof PosixNameSchema>;

type PosixNameIsSerializableKey = Assert<
  PosixName extends SerializableKey ? true : false
>;

// -----------------------------------------------------------------------------
// PosixEntry: node-attached value
// -----------------------------------------------------------------------------

/**
 * POSIX-specific meaning attached to a tree node.
 */
export type PosixEntry =
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

export const PosixEntrySchema: z.ZodType<PosixEntry> = z.discriminatedUnion(
  'kind',
  [PosixFileEntrySchema, PosixSymlinkEntrySchema, PosixDirectoryEntrySchema],
);

// -----------------------------------------------------------------------------
// PosixTreeNode: opaque domain tree
// -----------------------------------------------------------------------------

/**
 * An opaque tree whose IDs are POSIX entry names and whose values describe
 * POSIX entry semantics.
 */
export type PosixTreeNode = TreeNode<PosixName, PosixEntry>;

export const PosixTreeNodeApi = createTreeNodeApi<PosixName, PosixEntry>();

// -----------------------------------------------------------------------------
// POSIX domain constructors
// -----------------------------------------------------------------------------

export const PosixTreeNode = {
  file(name: PosixName): PosixTreeNode {
    return PosixTreeNodeApi.createLeaf(name, {
      kind: 'file',
    });
  },

  symlink(name: PosixName, target: UnixPath): PosixTreeNode {
    return PosixTreeNodeApi.createLeaf(name, {
      kind: 'symlink',
      target,
    });
  },

  unloadedDirectory(name: PosixName): PosixTreeNode {
    return PosixTreeNodeApi.createUnloadedBranch(name, {
      kind: 'directory',
    });
  },

  loadedDirectory(
    name: PosixName,
    children: Iterable<PosixTreeNode>,
  ): PosixTreeNode | undefined {
    return PosixTreeNodeApi.createLoadedBranch(
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
    const entry = PosixTreeNodeApi.value(node);
    const treeKind = PosixTreeNodeApi.kind(node);

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
    if (PosixTreeNodeApi.value(node).kind !== 'directory') {
      return undefined;
    }

    return PosixTreeNodeApi.withLoadedChildren(node, children);
  },

  /**
   * Converts a directory to an unloaded directory.
   *
   * Files and symlinks cannot be converted to branches through this POSIX API.
   */
  toUnloadedDirectory(node: PosixTreeNode): PosixTreeNode | undefined {
    if (PosixTreeNodeApi.value(node).kind !== 'directory') {
      return undefined;
    }

    return PosixTreeNodeApi.toUnloadedBranch(node);
  },
} as const;

// -----------------------------------------------------------------------------
// Serializable POSIX model
// -----------------------------------------------------------------------------

/**
 * This is a DTO / persistence shape, not the runtime domain type.
 *
 * It intentionally exposes `id`, `value`, and `children`, because serialized
 * data must have a concrete public format.
 */
export type PosixTreeNodeModel = TreeNodeModel<PosixName, PosixEntry>;

/**
 * Validates both the generic tree model shape and the POSIX-specific
 * file/symlink/directory invariants.
 *
 * Files and symlinks must be leaf models.
 * Directories must be unloaded or loaded branch models.
 */
export const PosixTreeNodeModelSchema: z.ZodType<PosixTreeNodeModel> = z.lazy(
  () =>
    z.union([
      // Leaf: file
      z
        .object({
          id: PosixNameSchema,
          value: PosixFileEntrySchema,
        })
        .strict(),

      // Leaf: symlink
      z
        .object({
          id: PosixNameSchema,
          value: PosixSymlinkEntrySchema,
        })
        .strict(),

      // Unloaded branch: directory
      z
        .object({
          id: PosixNameSchema,
          value: PosixDirectoryEntrySchema,
          children: z.null(),
        })
        .strict(),

      // Loaded branch: directory
      z
        .object({
          id: PosixNameSchema,
          value: PosixDirectoryEntrySchema,
          children: z.array(PosixTreeNodeModelSchema),
        })
        .strict(),
    ]),
);

/**
 * Decodes validated external data into the opaque domain type.
 *
 * `fromModel` additionally checks sibling-name uniqueness. That validation is
 * separate from Zod's object-shape validation.
 */
export function decodePosixTreeNode(input: unknown): PosixTreeNode | undefined {
  const model = PosixTreeNodeModelSchema.safeParse(input);

  if (!model.success) {
    return undefined;
  }

  const node = PosixTreeNodeApi.fromModel(model.data);

  if (node === undefined) {
    return undefined;
  }

  return PosixTreeNode.isValid(node) ? node : undefined;
}

export function encodePosixTreeNode(node: PosixTreeNode): PosixTreeNodeModel {
  return PosixTreeNodeApi.toModel(node);
}

// -----------------------------------------------------------------------------
// PosixFolds
// -----------------------------------------------------------------------------

/**
 * Fold definitions for one POSIX directory tree.
 */
export type PosixFolds = Folds<PosixName>;

/**
 * Folds internally store sparse trees whose values are direct child IDs hidden
 * at that tree position. This implementation detail remains private to the
 * POSIX domain module.
 */
const PosixFoldTreeNodeApi = createTreeNodeApi<
  PosixName,
  readonly PosixName[]
>();

export const PosixFoldsApi = createFoldsApi(PosixFoldTreeNodeApi);

export type PosixFoldsModel = FoldsModel<PosixName>;

export const PosixFoldsModelSchema: z.ZodType<PosixFoldsModel> =
  createFoldsModelSchema(PosixNameSchema);

// -----------------------------------------------------------------------------
// PosixCursor
// -----------------------------------------------------------------------------

export const PosixCursorSchema: z.ZodType<PosixCursor> =
  createCursorSchema(PosixNameSchema);

export type PosixCursor = Cursor<PosixName>;

export const PosixCursorApi = createCursorApi<PosixName>();

// -----------------------------------------------------------------------------
// PosixNavNode
// -----------------------------------------------------------------------------

/**
 * NavNode should now be parameterized by node value, not the recursive
 * application node shape.
 */
export type PosixNavNode = NavNode<PosixName>;

export const PosixNavApi = createNavNodeApi(
  PosixTreeNodeApi,
  PosixFoldsApi,
  PosixCursorApi,
  {
    compareEntries(left, right) {
      return left.id.localeCompare(right.id);
    },
  },
);

// -----------------------------------------------------------------------------
// PosixState
// -----------------------------------------------------------------------------

/**
 * State should now be parameterized by application value, not a recursive
 * structural node type.
 */
export type PosixState = State<PosixName, PosixEntry>;

export const PosixStateApi = createStateApi(PosixTreeNodeApi, PosixCursorApi);

export type PosixStateModel = StateModel<PosixName, PosixEntry>;

/**
 * The state schema should operate on a serializable tree *model*, then decode
 * it to opaque nodes. Do not try to make Zod construct TreeNode directly.
 */
export const PosixStateModelSchema: z.ZodType<PosixStateModel> =
  createStateModelSchema(
    PosixTreeNodeModelSchema,
    PosixFoldsModelSchema,
    PosixCursorSchema,
  );
