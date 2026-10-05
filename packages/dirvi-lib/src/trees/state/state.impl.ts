import type {
  SerializableKey,
  TreeNode,
  TreeNodeApi,
} from '../tree-node/index.js';
import type { Folds } from '../fold-node/index.js';
import type { Cursor, CursorApi } from '../cursor.js';
import type { StateApi, State } from './state.types.js';

type ReloadResult<Id extends SerializableKey, Value> = Readonly<{
  root: TreeNode<Id, Value>;
}>;

/**
 * Creates operations for navigating and resynchronizing tree-surfer state.
 */
export function createStateApi<Id extends SerializableKey, Value>(
  treeNodeApi: TreeNodeApi<Id, Value>,
  cursorApi: CursorApi<Id>,
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
    return [];
  }

  return {
    getNodeAtCursor(state) {
      const path = cursorApi.getPath(state.cursor);

      return treeNodeApi.selectAtPath(state.root, path, (node) => node);
    },

    async resync(oldState, loadBranches) {
      const reloaded = await reload(oldState.root, [], loadBranches);

      /*
       * Fold-state resynchronization is not implemented yet. Keep the existing
       * fold definitions while the source tree is reloaded.
       */
      const folds = oldState.folds;
      const root = reloaded.root;

      return {
        ...oldState,
        root,
        folds,
        cursor: resyncCursor(oldState, root, folds),
      };
    },
  };
}
