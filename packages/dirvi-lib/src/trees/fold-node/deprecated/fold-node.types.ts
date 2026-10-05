import type {
  TreeNode,
  TreeNodeApi,
  SerializableKey,
} from '../../tree-node/index.js';

/**
 * Application-specific state stored in each fold-tree node.
 *
 * Structural children are owned by TreeNode. `foldedChildren` are semantic
 * fold-state children: direct buffer entries whose contents are folded.
 */
export type FoldNodeValue<Id extends SerializableKey> = Readonly<{
  foldedChildren: readonly FoldNode<Id>[];
}>;

/**
 * A fold-state node.
 *
 * The structural child tree is represented by the opaque TreeNode. The value
 * holds only fold-specific state.
 */
export type FoldNode<Id extends SerializableKey> = TreeNode<
  Id,
  FoldNodeValue<Id>
>;

/**
 * Generic structural operations specialized to a fold-state tree.
 */
export type FoldNodeApi<Id extends SerializableKey> = TreeNodeApi<
  Id,
  FoldNodeValue<Id>
>;

/**
 * Semantic operations for managing fold state.
 *
 * @remarks
 *
 * `FoldNodeService` provides operations in terms of folded buffer entries
 * rather than generic tree-node updates.
 *
 * Paths are relative to the supplied root node:
 *
 *  - `[]` addresses the root
 *  - `['child']` addresses a direct child of the root;
 *  - `['child', 'grandchild']` addresses a descendant.
 *
 * Lookup and removal operations are strict and return `undefined` when the
 * requested path does not exist. Adding a folded entry may create missing
 * fold-state nodes along the requested path.
 *
 * @typeParam Id - The type of IDs in the actual tree nodes.
 */
export type FoldNodeService<Id extends SerializableKey> = {
  /**
   * Creates an empty fold-state node.
   *
   * It has no structural children and no folded entries.
   *
   * @returns A new empty fold-state node.
   */
  createEmptyNode(id: Id): FoldNode<Id>;

  /**
   * Tests whether a node is folded.
   *
   * The path identifies the node whose `foldedChildren` collection is inspected. An
   * empty path selects the root.
   *
   * This operation does not create missing fold-state nodes, or otherwise
   * mutate the `rootNode`.
   *
   * @param rootNode - The root of the fold-state tree.
   * @param path - A path relative to `rootNode`.
   * @param entryId - The ID of the direct buffer entry to test.
   * @returns `true` when the entry is folded at the resolved node;
   * otherwise `false`. Missing paths also return `false`.
   */
  getIfEntryFoldedAtPath(
    rootNode: FoldNode<Id>,
    path: readonly Id[],
    entryId: Id,
  ): boolean;

  /**
   * Returns the IDs of folded entries at the node at the path.
   *
   * Returns undefined if path has no fold node.
   */
  foldedEntriesAtPath(
    rootNode: FoldNode<Id>,
    path: readonly Id[],
  ): Id[] | undefined;

  /**
   * Marks a direct buffer entry as folded at a node.
   *
   * Missing fold-state nodes along the path are created. If the entry is
   * already folded, the existing fold-state tree is returned unchanged.
   * If the entry is currently in `children`, it is moved to `foldedChildren` while
   * preserving its nested fold state.
   *
   * Moving an entry preserves its nested `children` and `foldedChildren`, so fold
   * state below the newly folded entry is not lost.
   *
   * @param rootNode - The root of the fold-state tree.
   * @param path - A path relative to `rootNode`. An empty path selects the
   * root.
   * @param entryId - The ID of the direct buffer entry to fold.
   * @returns A new root containing the fold, or `undefined` when the path
   * cannot be updated.
   */
  addFoldedEntryAtPath(
    rootNode: FoldNode<Id>,
    path: readonly Id[],
    entryId: Id,
  ): FoldNode<Id> | undefined;

  /**
   * Removes the folded state for a direct buffer entry at a node.
   *
   * The entry is removed from `foldedChildren`. If the entry contains nested fold
   * state in either its `children` or `foldedChildren` collections, it is moved to
   * `children` so that the nested state is preserved. If it has no nested
   * fold state, it is omitted from both collections.
   *
   * This operation does not create missing fold-state nodes. If the entry is
   * not currently folded, the existing fold-state tree is returned unchanged.
   *
   * @param rootNode - The root of the fold-state tree.
   * @param path - A path relative to `rootNode`. An empty path selects the
   * root.
   * @param entryId - The ID of the direct buffer entry to unfold.
   * @returns A new root without the fold, or `undefined` when the path does
   * not exist.
   */
  removeFoldedEntryAtPath(
    rootNode: FoldNode<Id>,
    path: readonly Id[],
    entryId: Id,
  ): FoldNode<Id> | undefined;

  /**
   * Removes the folded state for all direct buffer entries at a node.
   *
   * Each entry is removed from `foldedChildren`. Entries that contain nested
   * fold state in either their `children` or `foldedChildren` collections are
   * moved to `children` so that their nested fold state is preserved. Entries
   * with no nested fold state are omitted from both collections.
   *
   * This operation does not create missing fold-state nodes. If the path does
   * not exist, the existing fold-state tree cannot be updated and `undefined`
   * is returned. When the resolved node has no folded entries, the existing
   * fold-state tree is returned unchanged.
   *
   * @param rootNode - The root of the fold-state tree.
   * @param path - A path relative to `rootNode`. An empty path selects the
   * root.
   * @returns A new root without the folds at the resolved node, or
   * `undefined` when the path does not exist.
   */
  clearFoldedEntriesAtPath(
    rootNode: FoldNode<Id>,
    path: readonly Id[],
  ): FoldNode<Id> | undefined;
};
