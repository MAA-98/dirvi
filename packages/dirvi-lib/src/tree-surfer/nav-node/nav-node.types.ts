import {
  BranchTreeNode,
  SerializableKey,
  TreeNode,
} from '../tree-node/tree-node.types.js';
import { Cursor } from '../cursor.js';
import { FoldNode } from '../fold-node/fold-node.types.js';

export type NavNode<Id extends SerializableKey> = {
  /**
   * Synthetic UI entry representing folded children.
   *
   * It is absent when this directory has no folded children.
   */
  folded: NavFoldEntry<Id> | null;
  
  /**
   * Loaded entries that are not folded at this directory, corresponding to
   * navigable rows. Entries retain the order from the TreeNode.
   */
  entries: NavEntry<Id>[];
};

export type NavFoldEntry<Id extends SerializableKey> = {
  /**
   * Folded entries that are present in the loaded TreeNode.
   *
   * This is information for rendering the folded row.
   */
  entries: NavEntry<Id>[];
};

export type NavEntry<Id extends SerializableKey> = NavLeaf<Id> | NavBranch<Id>;

export type NavLeaf<Id extends SerializableKey> = {
  id: Id;
};

export type NavBranch<Id extends SerializableKey> = {
  id: Id;
  children: NavNode<Id> | null;
};

export type NavNodeApi<Id extends SerializableKey, Node extends TreeNode<Id, Node>> = {
  /**
   * Tests whether a navigation entry represents a branch.
   *
   * A branch is an entry with a `children` property. Its `children` value is
   * `null` when the corresponding tree branch has not been loaded or opened.
   */
  entryIsBranch(entry: NavEntry<Id>): entry is NavBranch<Id>;

  /**
   * Creates a navigation projection of the tree node root.
   *
   * The root must be a branch node because navigation is rooted at a
   * directory-like node. The returned navigation entry is always a `NavBranch`.
   *
   * The TreeNode is authoritative for:
   *
   * - entry identity and order;
   * - whether the entry is a leaf or branch;
   * - whether branch children are loaded; and
   * - the loaded child entries.
   *
   * The optional FoldNode is authoritative for folding. When `foldRoot` is
   * undefined, the projection contains no folded entries.
   *
   * A folded entry is omitted from its parent's navigable entries and is
   * represented by that parent's synthetic `folded` entry instead.
   */
  from(
    root: Node & BranchTreeNode<Id, Node>,
    foldRoot: FoldNode<Id> | undefined
  ): NavBranch<Id>;

  getNodeAtPath(
    navigation: NavNode<Id>,
    path: readonly Id[],
  ): NavNode<Id> | undefined;

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

  parentCursor(
    navigation: NavNode<Id>,
    cursor: Cursor<Id>,
  ): Cursor<Id> | undefined;

  cursors(navigation: NavNode<Id>, parentPath?: Id[]): Cursor<Id>[];

  visibleLeavesPaths(
    navigation: NavNode<Id>,
    parentPath?: readonly Id[],
  ): Id[][];
};
