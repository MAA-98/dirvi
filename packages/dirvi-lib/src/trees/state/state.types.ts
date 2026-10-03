import type { Cursor } from '../cursor.js';
import type { Folds } from '../fold-node/index.js';
import type { SerializableKey, TreeNode } from '../tree-node/index.js';

/**
 * State for navigating a tree and its associated fold-state tree.
 *
 * Invariant: `root` is an open branch.
 *
 * Note: This cannot be represented through a structural intersection because
 * TreeNode is opaque; enforce it when constructing State, using
 * TreeNodeApi.state or TreeNodeApi.getChildren.
 *
 * @typeParam Id - Tree-node sibling ID type.
 * @typeParam Value - Application-owned value stored in every tree node.
 */
export type State<Id extends SerializableKey, Value> = Readonly<{
  root: TreeNode<Id, Value>;
  folds: Folds<Id>;
  cursor: Cursor<Id>;
}>;

export type StateApi<Id extends SerializableKey, Value> = Readonly<{
  getNodeAtCursor(state: State<Id, Value>): TreeNode<Id, Value> | undefined;

  /**
   * Reloads the root's children and all descendant branches that were loaded
   * in the previous state.
   *
   * `loadBranches([])` loads the root's direct children.
   * `loadBranches(['src'])` loads the children of `src`, where `src` is the
   * ID of a root child.
   *
   * Returned nodes must be valid TreeNode values created or decoded through
   * the specialized TreeNodeApi for `Id` and `Value`.
   */
  resync(
    oldState: State<Id, Value>,
    loadBranches: (
      path: readonly Id[],
    ) => Promise<readonly TreeNode<Id, Value>[]>,
  ): Promise<State<Id, Value>>;
}>;
