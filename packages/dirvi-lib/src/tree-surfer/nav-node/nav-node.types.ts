import { LeafTreeNode, SerializableKey, TreeNode } from '../tree-node/tree-node.types.js';
import { FoldNodeRoot } from '../fold-node/fold-node.types.js';
import { Cursor } from '../cursor.js';

/**
 * A navigation entry preserves the original buffer-node properties, but
 * replaces a branch's buffer children with a NavNode.
 */
export type NavEntry<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
> = NavLeaf<Id, BufferNode> | NavBranch<Id, BufferNode>;

export type NavLeaf<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
> = BufferNode & LeafTreeNode<Id>;

type ReplaceChildren<Node, Children> = Node extends {
  children: unknown;
}
  ? Omit<Node, 'children'> & {
      children: Children;
    }
  : never;

export type NavBranch<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
> = ReplaceChildren<BufferNode, NavNode<Id, BufferNode> | null>;

export function isNavBranch<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
>(entry: NavEntry<Id, BufferNode>): entry is NavBranch<Id, BufferNode> {
  return 'children' in entry;
}

/**
 * The derived tree as navigated: list of visible entries and folded entries.
 */
export type NavNode<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
> = {
  /**
   * Currently visible entries.
   */
  entries: NavEntry<Id, BufferNode>[];

  /**
   * Currently loaded entries hidden by this directory's fold.
   */
  foldedEntries: NavEntry<Id, BufferNode>[];
};

// ---*--- Nav Node API Types ---*---

export type NavNodeApi<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
> = {
  from(
    entries: BufferNode[],
    foldNode: FoldNodeRoot<Id>,
  ): NavNode<Id, BufferNode>;

  getNodeAtPath(
    navigation: NavNode<Id, BufferNode>,
    path: Id[],
  ): NavNode<Id, BufferNode> | undefined;

  getEntryAtPath(
    navigation: NavNode<Id, BufferNode>,
    path: Id[],
  ): NavEntry<Id, BufferNode> | undefined;

  nextCursor(
    rootNode: NavNode<Id, BufferNode>,
    cursor: Cursor<Id>,
  ): Cursor<Id> | undefined;

  previousCursor(
    rootNode: NavNode<Id, BufferNode>,
    cursor: Cursor<Id>,
  ): Cursor<Id> | undefined;

  cursorAfterFold(
    rootNode: NavNode<Id, BufferNode>,
    cursor: Cursor<Id>,
  ): Cursor<Id> | undefined;

  parentCursor(
    navigation: NavNode<Id, BufferNode>,
    cursor: Cursor<Id>,
  ): Cursor<Id> | undefined;

  cursors(navigation: NavNode<Id, BufferNode>, parentPath?: Id[]): Cursor<Id>[];

  visibleLeavesPaths(
    navigation: NavNode<Id, BufferNode>,
    parentPath?: Id[],
  ): Id[][];
};
