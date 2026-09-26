import { SerializableKey, TreeNodeApi } from '../tree-node/tree-node.types.js';

/**
 * A node in the fold-state tree.
 *
 * @remarks
 *
 * A fold-state tree is a sparse projection of a buffer tree. Apart from its
 * root, it stores only nodes that are folded or that have fold information
 * somewhere below them. It does not contain buffer entries or buffer-specific
 * properties.
 *
 * The `id` identifies the corresponding buffer entry among its siblings.
 *
 * `children` contains fold-state nodes for direct buffer entries that are not
 * folded at this node but have fold information below them.
 *
 * `foldedChildren` contains fold-state nodes for direct buffer entries whose contents
 * are folded at this node. Each folded entry is represented by a complete
 * `FoldNode`, allowing fold state within a folded entry to be preserved
 * recursively.
 *
 * A direct buffer entry with no fold state at or below it is omitted from both
 * collections. Consequently, the union of `children` and `foldedChildren` does not
 * need to contain every direct buffer child.
 *
 * The following invariant holds for every fold-state node:
 *
 *  - no ID occurs more than once in `children`;
 *  - no ID occurs more than once in `foldedChildren`;
 *  - no ID occurs in both collections;
 *  - every ID in either collection identifies a direct child in the
 *    corresponding buffer-tree node.
 *
 * Every fold node is an open branch from the perspective of `TreeNodeApi`.
 * Missing paths may nevertheless be created lazily by `FoldNodeService`.
 *
 * @typeParam Id - The type of IDs in the actual tree nodes.
 *
 * @example
 *
 * ```ts
 * type FileId = string;
 * type FileFoldNode = FoldNode<FileId>;
 *
 * const root: FileFoldNode = {
 *   id: '/',
 *   children: [],
 *   foldedChildren: [],
 * };
 * ```
 */
export type FoldNode<Id extends SerializableKey> = {
  id: Id;
  children: FoldNode<Id>[];
  foldedChildren: FoldNode<Id>[];
};

/**
 * Operations for inspecting and immutably updating a fold-state tree.
 *
 * @remarks
 *
 * This API is `TreeNodeApi` specialized for `FoldNode`. It provides structural
 * tree operations such as node lookup and immutable path updates.
 *
 * Paths are relative to the supplied root node:
 *
 *  - `[]` identifies the root;
 *  - `['child']` identifies a direct child of the root;
 *  - `['child', 'grandchild']` identifies a descendant.
 *
 * Path operations are strict. They operate only on nodes that already exist
 * in the fold-state tree. Use `FoldNodeService` when missing fold-state nodes
 * should be automatically created.
 *
 * The API does not interpret the `foldedChildren` collection. It only navigates and
 * updates the structural `children` tree. The semantic operations for adding
 * and removing foldedChildren belong to `FoldNodeService`.
 *
 * @typeParam Id - The type of IDs in the actual tree nodes.
 */
export type FoldNodeApi<Id extends SerializableKey> = TreeNodeApi<Id, FoldNode<Id>>;

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
  clearFoldedEntriesAtPath(
    rootNode: FoldNode<Id>,
    path: readonly Id[],
  ): FoldNode<Id> | undefined;
};
