import type { SerializableKey, TreeNode } from '../tree/index.js';
import type { Cursor } from '../cursor.js';
import type { Folds } from '../fold-node/index.js';

export type NavNode<Id extends SerializableKey> = {
  /**
   * Projected direct children, including fold summaries.
   *
   * Ordered navigation preserves source sibling order and inserts inline folds.
   * Unordered navigation uses presentation order and places its optional fold
   * summary first.
   *
   * Not every entry is therefore necessarily a cursor destination: in ordered
   * trees, the fold summary is not navigable and the NavMethod implementation
   * should skip it.
   */
  entries: NavEntry<Id>[];
};

export type NavEntry<Id extends SerializableKey> =
  | NavLeaf<Id>
  | NavBranch<Id>
  | NavFold<Id>;

export type NavLeaf<Id extends SerializableKey> = {
  id: Id;
};

export type NavBranch<Id extends SerializableKey> = {
  id: Id;

  /**
   * `null` means this branch's children have not been loaded.
   */
  children: NavNode<Id> | null;
};

export type NavFold<Id extends SerializableKey> = {
  /**
   * Folded entries that are present in the loaded TreeNode.
   *
   * For unordered trees, there is at most one folded entry, and it is the first
   * in nav node's `entries`.
   */
  folded: NavEntry<Id>[];
};

/**
 * Operations for creating and navigating a UI-oriented projection of a tree.
 *
 * @typeParam Id - The type identifying a node among its direct siblings.
 * @typeParam Value - Application-owned data stored in each source TreeNode.
 */
export type NavMethods<Id extends SerializableKey, Value> = {
  /**
   * Tests whether a navigation entry represents a branch.
   *
   * A branch is an entry with a `children` property. Its `children` value is
   * `null` when the corresponding source-tree branch has not been loaded or
   * opened.
   */
  entryIsBranch(entry: NavEntry<Id>): entry is NavBranch<Id>;

  /**
   * Tests whether a navigation entry represents a branch.
   */
  entryIsFold(entry: NavEntry<Id>): entry is NavFold<Id>;

  /**
   * Creates a navigation projection rooted at `root`.
   *
   * The source TreeNode is authoritative for:
   *
   * - entry identity;
   * - whether an entry is a leaf, closed branch, or open branch;
   * - the loaded direct child entries; and
   * - sibling iteration order, where guaranteed by TreeNodeApi.
   *
   * `foldRoot` is authoritative for folding. It contains multiple independently
   * active fold trees. An entry is folded in the projection when at least one
   * active fold tree hides that entry at its parent path.
   *
   * A folded entry is omitted from its parent's navigable entries and is
   * represented by that parent's synthetic `folded` entry instead.
   *
   * The root must be a branch node. Since TreeNode is opaque, callers cannot
   * express that fact statically. This method returns `undefined` if `root`
   * is a leaf.
   *
   * An unloaded branch produces a NavBranch whose `children` is `null`.
   *
   * @param root - Source tree node from which to create navigation.
   * @param folds - Fold definitions corresponding to `root`. All active fold
   * trees contribute to whether a source entry is represented by its parent’s
   * synthetic `folded` entry.
   * @returns The projected root branch, or `undefined` when `root` is a leaf.
   */
  from(root: TreeNode<Id, Value>, folds: Folds<Id>): NavBranch<Id> | undefined;

  /**
   * Finds the navigation node represented by a path relative to `navigation`.
   *
   * An empty path selects `navigation` itself. Paths cannot pass through leaf
   * entries or branches whose children are currently `null`.
   */
  getNodeAtPath(
    navigation: NavNode<Id>,
    path: readonly Id[],
  ): NavNode<Id> | undefined;

  /**
   * Finds the navigation entry represented by a path relative to `navigation`.
   *
   * An empty path does not identify an entry and returns `undefined`.
   */
  getEntryAtPath(
    navigation: NavNode<Id>,
    path: readonly Id[],
  ): NavEntry<Id> | undefined;

  nextCursor(
    rootNode: NavBranch<Id>,
    cursor: Cursor<Id>,
  ): Cursor<Id> | undefined;

  previousCursor(
    rootNode: NavBranch<Id>,
    cursor: Cursor<Id>,
  ): Cursor<Id> | undefined;

  cursorAfterFold(
    rootNode: NavBranch<Id>,
    cursor: Cursor<Id>,
  ): Cursor<Id> | undefined;

  /**
   * Returns undefined if at the root already, i.e. cursor is [].
   * @param navigation
   * @param cursor
   */
  parentCursor(
    navigation: NavNode<Id>,
    cursor: Cursor<Id>,
  ): Cursor<Id> | undefined;

  /**
   * Enumerates navigable positions in depth-first display order.
   *
   * Unordered navigation skips fold summaries.
   * Ordered navigation includes inline folds as fold cursors.
   */
  cursors(navigation: NavNode<Id>, parentPath?: readonly Id[]): Cursor<Id>[];

  visibleLeavesPaths(
    navigation: NavNode<Id>,
    parentPath?: readonly Id[],
  ): Id[][];
};
