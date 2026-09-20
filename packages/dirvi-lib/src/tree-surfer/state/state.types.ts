import type { Cursor } from '../cursor.js';
import type {
  SerializableKey,
  TreeNode,
} from '../tree-node/tree-node.types.js';
import type { FoldNode } from '../fold-node/fold-node.types.js';

export type State<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
> = {
  buffer: Node[];
  foldNode: FoldNode<Id>;
  cursor: Cursor<Id>;
};

export type StateApi<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
> = {
  getNodeAtCursor(state: State<Id, Node>): Node | undefined;

  /**
   * Reloads the root and all descendant branches that were loaded in the
   * previous state.
   */
  resync(
    oldState: State<Id, Node>,
    loadBranches: (path: Id[]) => Promise<Node[]>,
  ): Promise<State<Id, Node>>;
};
