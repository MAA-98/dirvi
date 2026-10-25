import type { SerializableKey, TreeNode, TreeMethods } from '../tree/index.js';
import type { FoldMethods, Folds } from '../fold-node/index.js';
import type { Cursor, CursorMethods } from '../cursor.js';

declare const stateBrand: unique symbol;

/**
 * Opaque type for state of the tree, folds, and cursor.
 *
 * Used by consumers as React State.
 */
export type State<Id extends SerializableKey, Value> = Readonly<{
  [stateBrand]: Readonly<{
    id: Id;
    value: Value;
  }>;
}>;

export type StateApi<Id extends SerializableKey, Value> = Readonly<{
  treeNodeApi: TreeMethods<Id, Value>;
  foldsApi: FoldMethods<Id>;
  cursorApi: CursorMethods<Id>;

  /**
   * Creates state whose root is a loaded branch.
   *
   * Returns undefined when root is a leaf or an unloaded branch.
   */
  create(
    root: TreeNode<Id, Value>,
    folds: Folds<Id>,
    cursor: Cursor<Id>,
  ): State<Id, Value> | undefined;

  getRoot(state: State<Id, Value>): TreeNode<Id, Value>;
  getFolds(state: State<Id, Value>): Folds<Id>;
  getCursor(state: State<Id, Value>): Cursor<Id>;

  /**
   * Immutably replaces supplied state components.
   *
   * Returns undefined when the replacement root is not a loaded branch.
   * Returns the original state when all components retain their references.
   */
  update(
    state: State<Id, Value>,
    changes: Readonly<{
      root?: TreeNode<Id, Value>;
      folds?: Folds<Id>;
      cursor?: Cursor<Id>;
    }>,
  ): State<Id, Value> | undefined;

  /**
   * Returns a mutable root-relative path.
   *
   * For a fold cursor, returns the path of its first hidden child.
   * This representative path does not identify the fold marker itself.
   */
  cursorPath(state: State<Id, Value>): Id[];
  /**
   * Tests whether the cursor is the root node cursor: { path: [] }.
   */
  isCursorRoot(state: State<Id, Value>): boolean;
  /**
   * Resolves a node cursor against the source tree.
   *
   * Returns undefined for fold cursors or paths absent from the loaded tree.
   * This does not check visibility in a navigation projection.
   */
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