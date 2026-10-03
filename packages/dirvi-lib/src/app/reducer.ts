import type {
  FoldsApi,
  SerializableKey,
  State,
  TreeNodeApi,
} from '../trees/index.js';
import type { ReducerAction } from './reducer-action.js';

export type Reducer<Id extends SerializableKey, Value> = (
  state: State<Id, Value>,
  action: ReducerAction<Id, Value>,
) => State<Id, Value>;

export function createReducer<Id extends SerializableKey, Value>(
  treeNodeApi: TreeNodeApi<Id, Value>,
  foldsApi: FoldsApi<Id>,
): Reducer<Id, Value> {
  /*
   * The current zc/zo input actions operate on the required primary fold tree.
   * Indexed fold-tree commands can add an index to ReducerAction later.
   */
  const primaryFoldIndex = 0;
  
  return (state, action) => {
    switch (action.kind) {
      case 'changeCursor':
        return {
          ...state,
          cursor: action.cursor,
        };

      case 'updateBranch': {
        const root = treeNodeApi.updateAtPath(
          state.root,
          action.path,
          (node) => {
            /*
             * Loading/unloading is a branch-only operation. TreeNodeApi can
             * structurally convert any node, but the application reducer must
             * not turn a leaf into a branch.
             */
            if (treeNodeApi.kind(node) === 'leaf') {
              return undefined;
            }

            if (action.entries === null) {
              return treeNodeApi.toUnloadedBranch(node);
            }

            return treeNodeApi.withLoadedChildren(node, action.entries);
          },
        );

        /*
         * State requires its root to remain a loaded branch. In particular,
         * refuse an accidental updateBranch with path [] and entries null.
         */
        if (root === undefined || treeNodeApi.kind(root) !== 'loaded-branch') {
          return state;
        }

        return {
          ...state,
          root,
        };
      }

      case 'setState': {
        // A newer update has already been applied.
        if (state !== action.oldState) {
          return state;
        }

        return {
          ...action.newState,
        };
      }

      case 'fold': {
        const entryId = action.path.at(-1);

        if (entryId === undefined) {
          return state;
        }

        const parentPath = action.path.slice(0, -1);
        const folds = foldsApi.hideEntryAtPath(
          state.folds,
          primaryFoldIndex,
          parentPath,
          entryId,
        );

        if (folds === undefined) {
          return state;
        }

        return {
          ...state,
          folds,
          cursor: action.cursor,
        };
      }

      case 'unfold': {
        const folds = foldsApi.showAllHiddenEntriesAtPath(
          state.folds,
          primaryFoldIndex,
          action.path,
        );

        if (folds === undefined) {
          return state;
        }

        return {
          ...state,
          folds,
          cursor: action.cursor,
        };
      }
    }
  };
}
