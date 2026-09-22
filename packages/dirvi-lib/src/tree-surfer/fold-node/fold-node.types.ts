import { SerializableKey, TreeNodeApi } from '../tree-node/tree-node.types.js';

/**
 * A node in the fold-state tree.
 *
 * @remarks
 *
 * A fold-state tree mirrors the structure of a buffer tree, but stores only
 * folding state. It does not contain buffer entries or buffer-specific
 * properties.
 *
 * The `id` identifies the corresponding buffer entry among its siblings.
 * `children` contains the fold-state nodes for entries below this node.
 *
 * The `folds` set contains the IDs of direct buffer entries whose folded state
 * is associated with this node. Fold order is not represented by the fold
 * state; the buffer tree remains responsible for entry order.
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
 *   folds: new Set(),
 * };
 * ```
 */
export type FoldNode<Id extends SerializableKey> = {
  id: Id;
  children: FoldNode<Id>[];
  folds: ReadonlySet<Id>;
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
 * The API does not interpret the `folds` set. It only navigates and updates
 * the fold-state tree. The semantic operations for adding, removing, and
 * clearing folds belong to `FoldNodeService`.
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
 *  - `[]` addresses the root;
 *  - `['child']` addresses a direct child of the root;
 *  - `['child', 'grandchild']` addresses a descendant.
 *
 * Lookup, removal, and clearing operations are strict and return `undefined`
 * when the requested path does not exist.
 *
 * Adding a folded entry is different: it creates missing fold-state nodes
 * along the requested path by using the service's configured child factory.
 * This allows fold state to be populated lazily as buffer entries are
 * encountered.
 *
 * @typeParam Id - The type of IDs in the actual tree nodes.
 */
export type FoldNodeService<Id extends SerializableKey> = {
  /**
   * Creates an empty fold-state root.
   *
   * The root uses the ID configured when the service was created. It has no
   * child fold-state nodes and no folded entries.
   *
   * NOTE: This gives a limitation that the root node cannot be renamed.
   *
   * @returns A new empty fold-state root.
   */
  createEmptyRoot(): FoldNode<Id>;

  /**
   * Tests whether a direct buffer entry is folded at a node.
   *
   * The path identifies the node whose `folds` set is inspected. An empty
   * path selects the root.
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
    path: Id[],
    entryId: Id,
  ): boolean;

  /**
   * Marks a direct buffer entry as folded at a node.
   *
   * Missing fold-state nodes along the path are created. If the entry is
   * already folded, the existing fold-state tree is returned unchanged.
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
    path: Id[],
    entryId: Id,
  ): FoldNode<Id> | undefined;

  /**
   * Removes the folded state for a direct buffer entry at a node.
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
    path: Id[],
    entryId: Id,
  ): FoldNode<Id> | undefined;

  /**
   * Removes all folded-entry state associated with a node.
   *
   * Descendant fold-state nodes and their `folds` sets are preserved. Only the
   * selected node's set of folded direct entries is cleared.
   *
   * @param rootNode - The root of the fold-state tree.
   * @param path - A path relative to `rootNode`. An empty path selects the
   * root.
   * @returns A new root with the selected node's folds cleared, or `undefined`
   * when the path does not exist.
   */
  clearFoldedEntriesAtPath(
    rootNode: FoldNode<Id>,
    path: Id[],
  ): FoldNode<Id> | undefined;
};
