import { SerializableKey } from '../tree-node/tree-node.types.js';

/**
 * Fold state associated with a branch in the tree.
 *
 * The `folds` set contains the IDs of entries folded at this node. Fold
 * order is not represented here; the buffer tree determines entry order.
 *
 * The type is structurally compatible with `TreeNode`, allowing the shared
 * `TreeNodeApi` to be used for path traversal and immutable updates.
 *
 * The root directory uses this same shape. It is not rendered by the UI, but
 * its children and fold state are rendered as the top-level tree.
 */
export type FoldNode<Id extends SerializableKey> = {
  children: FoldNode<Id>[];
  folds: ReadonlySet<Id>;
  id: Id;
};

/**
 * Operations for navigating and immutably updating fold-tree structure.
 *
 * This API is a projection of `TreeNodeApi` onto the fold-tree
 * representation. Path operations are strict: they only operate on
 * paths that already exist. Creation of missing fold paths belongs to
 * `FoldNodeService`.
 */
export type FoldNodeApi<Id extends SerializableKey> = {
  /**
   * Returns the children of the fold node.
   */
  getChildren(node: FoldNode<Id>): Iterable<FoldNode<Id>>;

  /**
   * Returns a direct child by ID.
   */
  getChildById(
    node: FoldNode<Id>,
    id: Id,
  ): FoldNode<Id> | undefined;

  /**
   * Selects a fold node at a path below the root.
   *
   * `[]` means the root, `[firstChild]` refers to the child at depth 1.
   */
  getAtPath<Result>(
    root: FoldNode<Id>,
    path: Id[],
    selector: (node: FoldNode<Id>) => Result,
  ): Result | undefined;

  /**
   * Immutably modifies a fold node at a path below the root.
   */
  modifyAtPath(
    root: FoldNode<Id>,
    path: Id[],
    modifier: (node: FoldNode<Id>) => FoldNode<Id> | undefined,
  ): FoldNode<Id> | undefined;
};

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
