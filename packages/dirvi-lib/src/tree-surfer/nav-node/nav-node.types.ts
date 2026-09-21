import {
  LeafTreeNode,
  SerializableKey,
  TreeNode,
} from '../tree-node/tree-node.types.js';
import { Cursor } from '../cursor.js';
import { FoldNode } from '../fold-node/fold-node.types.js';

/**
 * A navigation entry preserves the original node properties, but
 * replaces a branch's children with a NavNode.
 */
export type NavEntry<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
> = NavLeaf<Id, Node> | NavBranch<Id, Node>;

export type NavLeaf<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
> = Node & LeafTreeNode<Id>;

type ReplaceChildren<Node, Children> = Node extends {
  children: unknown;
}
  ? Omit<Node, 'children'> & {
      children: Children;
    }
  : never;

export type NavBranch<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
> = ReplaceChildren<Node, NavNode<Id, Node> | null>;

export function isNavBranch<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
>(entry: NavEntry<Id, Node>): entry is NavBranch<Id, Node> {
  return 'children' in entry;
}

/**
 * The derived tree as navigated: list of visible entries and folded entries.
 */
export type NavNode<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
> = {
  /**
   * Currently visible entries.
   */
  entries: NavEntry<Id, Node>[];

  /**
   * Currently loaded entries hidden by this directory's fold.
   */
  foldedEntries: NavEntry<Id, Node>[];
};

// ---*--- Nav Node API Types ---*---

export type NavNodeApi<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
> = {
  from(
    entries: Node[],
    foldNode: FoldNode<Id>,
  ): NavNode<Id, Node>;

  getNodeAtPath(
    navigation: NavNode<Id, Node>,
    path: Id[],
  ): NavNode<Id, Node> | undefined;

  getEntryAtPath(
    navigation: NavNode<Id, Node>,
    path: Id[],
  ): NavEntry<Id, Node> | undefined;

  nextCursor(
    rootNode: NavNode<Id, Node>,
    cursor: Cursor<Id>,
  ): Cursor<Id> | undefined;

  previousCursor(
    rootNode: NavNode<Id, Node>,
    cursor: Cursor<Id>,
  ): Cursor<Id> | undefined;

  cursorAfterFold(
    rootNode: NavNode<Id, Node>,
    cursor: Cursor<Id>,
  ): Cursor<Id> | undefined;

  parentCursor(
    navigation: NavNode<Id, Node>,
    cursor: Cursor<Id>,
  ): Cursor<Id> | undefined;

  cursors(navigation: NavNode<Id, Node>, parentPath?: Id[]): Cursor<Id>[];

  visibleLeavesPaths(
    navigation: NavNode<Id, Node>,
    parentPath?: Id[],
  ): Id[][];
};
