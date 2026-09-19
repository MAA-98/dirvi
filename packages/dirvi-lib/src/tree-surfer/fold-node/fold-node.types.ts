import { SerializableKey } from '../tree-node/tree-node.types.js';

/**
 * The whole fold state for a tree-node tree.
 *
 * The root has no ID because it represents the fold at the root.
 * Its `children` contain the fold nodes for the forest's root entries.
 *
 * `folds` contains the IDs folded at this root. Fold order is not
 * represented here; the buffer tree determines entry order.
 */
export type FoldNodeRoot<Id extends SerializableKey> = {
  children: FoldNode<Id>[];
  folds: ReadonlySet<Id>;
};

/**
 * Fold state associated with a node in the buffer tree.
 *
 * A fold node has the shape of an open tree node: its children are always
 * represented by an array, and an empty `children` array means that no child
 * fold nodes are currently represented.
 *
 * The `folds` set contains the IDs of entries folded at this node. Fold
 * order is not represented here; the buffer tree determines entry order.
 *
 * The type is structurally compatible with `TreeNode`, allowing the shared
 * `TreeNodeApi` to be used for path traversal and immutable updates.
 */
export type FoldNode<Id extends SerializableKey> = FoldNodeRoot<Id> & {
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
   * Returns the children of either the fold root or a fold node.
   */
  getChildren(node: FoldNodeRoot<Id> | FoldNode<Id>): Iterable<FoldNode<Id>>;

  /**
   * Returns a direct child by ID.
   */
  getChildById(
    node: FoldNodeRoot<Id> | FoldNode<Id>,
    id: Id,
  ): FoldNode<Id> | undefined;

  /**
   * Selects a fold node at a path below the root.
   */
  getAtPath<Result>(
    rootNode: FoldNodeRoot<Id>,
    path: Id[],
    selector: (node: FoldNode<Id>) => Result,
  ): Result | undefined;

  /**
   * Immutably modifies a fold node at a path below the root.
   */
  modifyAtPath(
    rootNode: FoldNodeRoot<Id>,
    path: Id[],
    modifier: (node: FoldNode<Id>) => FoldNode<Id> | undefined,
  ): FoldNodeRoot<Id> | undefined;
};

/**
 * Semantic operations for managing folded buffer entries.
 *
 * Unlike `FoldNodeApi`, the service may create missing fold paths when
 * adding a fold. This allows an empty root to be populated lazily.
 */
export type FoldNodeService<Id extends SerializableKey> = {
  createEmptyRoot(): FoldNodeRoot<Id>;

  getIfEntryFoldedAtPath(
    rootNode: FoldNodeRoot<Id>,
    path: Id[],
    entryId: Id,
  ): boolean;

  addFoldedEntryAtPath(
    rootNode: FoldNodeRoot<Id>,
    path: Id[],
    entryId: Id,
  ): FoldNodeRoot<Id> | undefined;

  removeFoldedEntryAtPath(
    rootNode: FoldNodeRoot<Id>,
    path: Id[],
    entryId: Id,
  ): FoldNodeRoot<Id> | undefined;

  clearFoldedEntriesAtPath(
    rootNode: FoldNodeRoot<Id>,
    path: Id[],
  ): FoldNodeRoot<Id> | undefined;
};
