import type { Cursor } from '../cursor.js';
import {
  OpenBranchTreeNode,
  SerializableKey,
  TreeNode,
} from '../tree-node/tree-node.types.js';
import type { FoldNode } from '../fold-node/fold-node.types.js';

/**
 * The state root is always open because its direct children are loaded during
 * state synchronization.
 */
export type StateRoot<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
> = Node & OpenBranchTreeNode<Id, Node>;

export type State<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>
> = {
  root: StateRoot<Id, Node>;
  foldRoot: FoldNode<Id>;
  cursor: Cursor<Id>;
};

export type StateApi<Id extends SerializableKey, Node extends TreeNode<Id, Node>> = {
  getNodeAtCursor(state: State<Id, Node>): Node | undefined;

  /**
   * Reloads the root's children and all descendant branches that were loaded in
   * the previous state.
   *
   * `loadBranches([])` loads the root's direct children.
   * `loadBranches(['src'])` loads the children of `src`, where 'src' is the
   * id of a root's child.
   */
  resync(
    oldState: State<Id, Node>,
    loadBranches: (path: Id[]) => Promise<Node[]>,
  ): Promise<State<Id, Node>>;
};
