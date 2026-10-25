import type {
  SerializableKey,
  TreeNode,
  TreeMethods,
} from '../tree/index.js';
import type { Folds, FoldMethods } from '../fold-node/index.js';
import type { Cursor, CursorMethods } from '../cursor.js';
import type { StateApi, State } from './state.types.js';

// =============================================================================
// Opaque Type Implementation
// =============================================================================

/**
 * Opaque state type implementation.
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
type StateData<Id extends SerializableKey, Value> = Readonly<{
  root: TreeNode<Id, Value>;
  folds: Folds<Id>;
  cursor: Cursor<Id>;
}>;

function getStateData<Id extends SerializableKey, Value>(
  state: State<Id, Value>,
): StateData<Id, Value> {
  return state as unknown as StateData<Id, Value>;
}

function createState<Id extends SerializableKey, Value>(
  data: StateData<Id, Value>,
): State<Id, Value> {
  return data as unknown as State<Id, Value>;
}

// =============================================================================
// StateApi Init
// =============================================================================

type ReloadResult<Id extends SerializableKey, Value> = Readonly<{
  root: TreeNode<Id, Value>;
}>;

/**
 * Creates operations for navigating and resynchronizing tree-surfer state.
 */
export function createStateApi<Id extends SerializableKey, Value>(
  treeNodeApi: TreeMethods<Id, Value>,
  foldsApi: FoldMethods<Id>,
  cursorApi: CursorMethods<Id>,
): StateApi<Id, Value> {
  /**
   * Reloads one node's direct children and recursively reloads descendant
   * branches that were open in the old state.
   *
   * The node itself retains its existing application value. The supplied
   * loader refreshes only its direct child collection.
   *
   * A branch that was previously closed remains closed: its children were not
   * loaded in the old state, so there is no descendant loading state to
   * preserve or refresh.
   */
  async function reload(
    oldRoot: TreeNode<Id, Value>,
    parentPath: readonly Id[],
    loadBranches: (
      path: readonly Id[],
    ) => Promise<readonly TreeNode<Id, Value>[]>,
  ): Promise<ReloadResult<Id, Value>> {
    const oldChildren = treeNodeApi.getLoadedChildren(oldRoot);

    /*
     * The old node was either a leaf or a closed branch. In either case, it
     * had no loaded child collection to resynchronize.
     */
    if (oldChildren === undefined) {
      return { root: oldRoot };
    }

    const loadedChildren = await loadBranches(parentPath);

    /*
     * `withChildren` retains oldRoot's ID and application value, replacing
     * only its structural child collection.
     *
     * Failure means the loader supplied duplicate sibling IDs, violating the
     * TreeNodeApi contract. This is a loader/data-integrity error rather than
     * an ordinary missing-path condition.
     */
    let newRoot = treeNodeApi.withLoadedChildren(oldRoot, loadedChildren);

    if (newRoot === undefined) {
      throw new Error(
        'Cannot resync tree: loaded branch contains duplicate sibling IDs',
      );
    }

    /*
     * Recurse only into entries that were open in the old state and which
     * still exist in the freshly loaded child collection.
     *
     * This preserves fresh values from loaded children while restoring their
     * previously loaded descendant collections.
     */
    for (const oldEntry of oldChildren) {
      const oldEntryChildren = treeNodeApi.getLoadedChildren(oldEntry);

      /*
       * A leaf or closed branch did not have loaded descendants in old state.
       */
      if (oldEntryChildren === undefined) {
        continue;
      }

      const oldEntryId = treeNodeApi.id(oldEntry);
      const currentChildren = treeNodeApi.getLoadedChildren(newRoot);

      if (currentChildren === undefined) {
        throw new Error(
          'Cannot resync tree: replacement root unexpectedly has no children',
        );
      }

      const currentChildrenArray = [...currentChildren];

      const currentChildIndex = currentChildrenArray.findIndex(
        (child) => treeNodeApi.id(child) === oldEntryId,
      );

      if (currentChildIndex === -1) {
        continue;
      }

      const currentChild = currentChildrenArray[currentChildIndex];

      if (currentChild === undefined) {
        continue;
      }

      if (treeNodeApi.kind(currentChild) === 'leaf') {
        continue;
      }

      const reloadedChild = await reload(
        oldEntry,
        [...parentPath, oldEntryId],
        loadBranches,
      );

      const reloadedGrandchildren = treeNodeApi.getLoadedChildren(
        reloadedChild.root,
      );

      if (reloadedGrandchildren === undefined) {
        throw new Error(
          'Cannot resync tree: reloaded open branch has no children',
        );
      }

      const updatedCurrentChild = treeNodeApi.withLoadedChildren(
        currentChild,
        reloadedGrandchildren,
      );

      if (updatedCurrentChild === undefined) {
        throw new Error(
          'Cannot resync tree: reloaded descendants contain duplicate sibling IDs',
        );
      }

      const updatedChildren = [...currentChildrenArray];
      updatedChildren[currentChildIndex] = updatedCurrentChild;

      const updatedRoot = treeNodeApi.withLoadedChildren(
        newRoot,
        updatedChildren,
      );

      if (updatedRoot === undefined) {
        throw new Error(
          'Cannot resync tree: updated branch contains duplicate sibling IDs',
        );
      }

      newRoot = updatedRoot;
    }

    return {
      root: newRoot,
    };
  }

  /**
   * Determines the cursor after resynchronization.
   *
   * Current policy: return the root cursor.
   *
   * Future policy:
   *
   * 1. Keep the exact cursor if it survives.
   * 2. Otherwise choose the deepest surviving ancestor.
   * 3. Otherwise choose the nearest preceding surviving cursor.
   * 4. Otherwise choose the first valid cursor.
   * 5. If no entry cursor exists, use the root cursor.
   */
  function resyncCursor(
    _oldState: State<Id, Value>,
    _newRoot: TreeNode<Id, Value>,
    _newFolds: Folds<Id>,
  ): Cursor<Id> {
    return { path: [] };
  }

  return {
    treeNodeApi,
    foldsApi,
    cursorApi,

    create(root, folds, cursor) {
      return treeNodeApi.kind(root) === 'loaded-branch'
        ? createState({ root, folds, cursor })
        : undefined;
    },

    getRoot(state) {
      return getStateData(state).root;
    },

    getFolds(state) {
      return getStateData(state).folds;
    },

    getCursor(state) {
      return getStateData(state).cursor;
    },

    update(state, changes) {
      const data = getStateData(state);
      const root = changes.root ?? data.root;
      const folds = changes.folds ?? data.folds;
      const cursor = changes.cursor ?? data.cursor;

      if (treeNodeApi.kind(root) !== 'loaded-branch') {
        return undefined;
      }

      if (
        root === data.root &&
        folds === data.folds &&
        cursor === data.cursor
      ) {
        return state;
      }

      return createState({ root, folds, cursor });
    },

    getNodeAtCursor(state) {
      const { root, cursor } = getStateData(state);

      /*
       * A fold cursor identifies a display item, not a single source node.
       * Its representative path must not silently select its first child.
       */
      if (!cursorApi.isNodeCursor(cursor)) {
        return undefined;
      }

      return treeNodeApi.selectAtPath(root, cursor.path, (node) => node);
    },

    isCursorRoot(state) {
      const { cursor } = getStateData(state);

      return cursorApi.isNodeCursor(cursor) && cursor.path.length === 0;
    },

    cursorPath(state) {
      const { cursor } = getStateData(state);

      return cursorApi.getPath(cursor);
    },

    async resync(oldState, loadBranches) {
      const oldStateData = getStateData(oldState);
      const reloaded = await reload(oldStateData.root, [], loadBranches);

      /*
       * Fold-state resynchronization is not implemented yet. Keep the existing
       * fold definitions while the source tree is reloaded.
       */
      const folds = oldStateData.folds;
      const root = reloaded.root;

      return createState({
        root,
        folds,
        cursor: resyncCursor(oldState, root, folds),
      });
    },
  };
}
