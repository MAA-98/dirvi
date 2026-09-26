import type { Cursor } from '../cursor.js';
import {
  BranchTreeNode,
  SerializableKey,
  TreeNode,
} from '../tree-node/tree-node.types.js';
import type { FoldNode } from '../fold-node/fold-node.types.js';

export type State<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>
> = {
  root: Node & BranchTreeNode<Id, Node>;
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
