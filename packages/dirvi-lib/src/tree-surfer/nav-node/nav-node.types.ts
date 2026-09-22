import {
  OpenBranchTreeNode,
  SerializableKey,
  TreeNode,
} from '../tree-node/tree-node.types.js';
import { Cursor } from '../cursor.js';
import { FoldNode } from '../fold-node/fold-node.types.js';
import { StateRoot } from '../state/state.types.js';

export type NavEntry<Id extends SerializableKey> = NavLeaf<Id> | NavBranch<Id>;

export type NavLeaf<Id extends SerializableKey> = {
  id: Id;
};

export type NavBranch<Id extends SerializableKey> = {
  id: Id;
  children: NavNode<Id> | null;
};

export type NavNode<Id extends SerializableKey> = {
  /**
   * Currently visible entries.
   */
  entries: NavEntry<Id>[];

  /**
   * Currently loaded entries hidden by this directory's fold.
   */
  foldedEntries: NavEntry<Id>[];
};

// ---*--- Nav Node API Types ---*---

export function isNavBranch<Id extends SerializableKey>(
  entry: NavEntry<Id>,
): entry is NavBranch<Id> {
  return 'children' in entry;
}

export type NavNodeApi<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
> = {
  from(
    root: StateRoot<Id, Node>,
    foldRoot: FoldNode<Id>,
  ): NavNode<Id>;

  getNodeAtPath(
    navigation: NavNode<Id>,
    path: readonly Id[],
  ): NavNode<Id> | undefined;

  getEntryAtPath(
    navigation: NavNode<Id>,
    path: readonly Id[],
  ): NavEntry<Id> | undefined;

  nextCursor(
    rootNode: NavNode<Id>,
    cursor: Cursor<Id>,
  ): Cursor<Id> | undefined;

  previousCursor(
    rootNode: NavNode<Id>,
    cursor: Cursor<Id>,
  ): Cursor<Id> | undefined;

  cursorAfterFold(
    rootNode: NavNode<Id>,
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
