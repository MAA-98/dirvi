import { SerializableKey, TreeNodeApi } from '../tree-node/tree-node.types.js';

/**
 * Fold state associated with a branch in the tree.
 *
 * The `folds` set contains the IDs of entries folded at this node. Fold
 * order is not represented here; the buffer tree determines entry order.
 *
 * The type is structurally compatible with `TreeNode`, allowing the shared
 * `TreeNodeApi` to be used for path traversal and immutable updates.
 */
export type FoldNode<Id extends SerializableKey> = {
  id: Id;
  children: FoldNode<Id>[];
  folds: ReadonlySet<Id>;
};

/**
 * Operations for navigating and immutably updating fold-tree structure.
 *
 * This API is a projection of `TreeNodeApi` onto the fold-tree
 * representation. Path operations are strict: they only operate on
 * paths that already exist. Creation of missing fold paths belongs to
 * `FoldNodeService`.
 */
export type FoldNodeApi<Id extends SerializableKey> = TreeNodeApi<Id, FoldNode<Id>>;

/**
 * Semantic operations for managing folded buffer entries.
 *
 * Unlike `FoldNodeApi`, the service may create missing fold paths when
 * adding a fold. This allows an empty root to be populated lazily.
 */
export type FoldNodeService<Id extends SerializableKey> = {
  createEmptyRoot(): FoldNode<Id>;

  getIfEntryFoldedAtPath(
    rootNode: FoldNode<Id>,
    path: Id[],
    entryId: Id,
  ): boolean;

  addFoldedEntryAtPath(
    rootNode: FoldNode<Id>,
    path: Id[],
    entryId: Id,
  ): FoldNode<Id> | undefined;

  removeFoldedEntryAtPath(
    rootNode: FoldNode<Id>,
    path: Id[],
    entryId: Id,
  ): FoldNode<Id> | undefined;

  clearFoldedEntriesAtPath(
    rootNode: FoldNode<Id>,
    path: Id[],
  ): FoldNode<Id> | undefined;
};
