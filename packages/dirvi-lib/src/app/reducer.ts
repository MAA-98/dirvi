import type {
  FoldsApi,
  SerializableKey,
  State,
  TreeNodeApi,
} from '../trees/index.js';
import type { ReducerAction } from './reducer-action.js';

function firstAvailableAdditionalFoldIndex<Id extends SerializableKey, Value>(
  foldsApi: FoldsApi<Id>,
  state: State<Id, Value>,
): number {
  let index = 1;

  while (foldsApi.hasAtIndex(state.folds, index)) {
    index += 1;
  }

  return index;
}

export type Reducer<Id extends SerializableKey, Value> = (
  state: State<Id, Value>,
  action: ReducerAction<Id, Value>,
) => State<Id, Value>;

export function createReducer<Id extends SerializableKey, Value>(
  treeNodeApi: TreeNodeApi<Id, Value>,
  foldsApi: FoldsApi<Id>,
): Reducer<Id, Value> {
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

      case 'addToFoldTree': {
        const entryId = action.path.at(-1);

        if (entryId === undefined) {
          return state;
        }

        const parentPath = action.path.slice(0, -1);
        const folds = foldsApi.hideEntryAtPath(
          state.folds,
          action.foldTreeIndex,
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

      case 'removeFromFoldTree': {
        // TODO: Change to show only entry at cursor. mirroring addToFoldTree
        const folds = foldsApi.showAllHiddenEntriesAtPath(
          state.folds,
          action.foldTreeIndex,
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

      case 'fold': {
        const folds = foldsApi.activateAtIndex(
          state.folds,
          action.foldTreeIndex,
        );

        return folds === undefined
          ? state
          : {
              ...state,
              folds,
            };
      }

      case 'unfold': {
        const folds = foldsApi.deactivateAtIndex(
          state.folds,
          action.foldTreeIndex,
        );

        return folds === undefined
          ? state
          : {
              ...state,
              folds,
            };
      }

      case 'toggleFold': {
        const folds = foldsApi.toggleActiveAtIndex(
          state.folds,
          action.foldTreeIndex,
        );

        return folds === undefined
          ? state
          : {
              ...state,
              folds,
            };
      }

      case 'createFoldTree': {
        const index = firstAvailableAdditionalFoldIndex(foldsApi, state);

        const folds = foldsApi.setAdditionalFoldAtIndex(
          state.folds,
          index,
          // Obtain this through the actual TreeNodeApi root-ID operation.
          treeNodeApi.id(state.root),
          {
            name: action.name,
            description: null,
          },
        );

        return folds === undefined
          ? state
          : {
              ...state,
              folds,
            };
      }

      case 'deleteFoldTree': {
        const index = foldsApi.getIndexByName(state.folds, action.name);

        if (index === undefined || index === 0) {
          return state;
        }

        const folds = foldsApi.removeAdditionalFoldAtIndex(state.folds, index);

        return folds === undefined
          ? state
          : {
              ...state,
              folds,
            };
      }

      default: {
        const _exhaustive: never = action;

        throw new Error(
          `Unhandled reducer action: ${JSON.stringify(_exhaustive)}`,
        );
      }
    }
  };
}
