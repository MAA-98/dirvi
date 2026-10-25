import type { Cursor } from '../../state-and-nav/cursor.js';
import type {
  FoldIndex,
  FoldMethods,
  Folds,
} from '../../state-and-nav/index.js';
import type {
  NavMethods,
} from '../../state-and-nav/index.js';
import type {
  SerializableKey,
} from '../../state-and-nav/index.js';
import type { State, StateApi } from '../../state-and-nav/index.js';
import type { ReducerAction } from './reducer-action.js';

function firstAvailableAdditionalFoldIndex<Id extends SerializableKey>(
  foldsApi: FoldMethods<Id>,
  folds: Folds<Id>,
): FoldIndex {
  let index = 1;

  while (foldsApi.hasAtIndex(folds, index)) {
    index += 1;
  }

  return index;
}

export type Reducer<Id extends SerializableKey, Value> = (
  state: State<Id, Value>,
  action: ReducerAction<Id, Value>,
) => State<Id, Value>;

export function createReducer<Id extends SerializableKey, Value>(
  stateApi: StateApi<Id, Value>,
  navNodeApi: NavMethods<Id, Value>,
): Reducer<Id, Value> {
  const { treeNodeApi, foldsApi, cursorApi } = stateApi;

  /**
   * Preserve the cursor if its position remains navigable. Otherwise, move it
   * to a fold marker containing its representative entry, or to the nearest
   * visible ancestor.
   */
  function reconcileCursor(state: State<Id, Value>): State<Id, Value> {
    const navigation = navNodeApi.from(
      stateApi.getRoot(state),
      stateApi.getFolds(state),
    );

    if (navigation === undefined || navigation.children === null) {
      // StateApi guarantees that the root is a loaded branch.
      throw new Error('Cannot navigate state: root is not a loaded branch.');
    }

    const cursor = stateApi.getCursor(state);
    const positions: Cursor<Id>[] = [
      { path: [] },
      ...navNodeApi.cursors(navigation.children),
    ];

    if (positions.some((position) => cursorApi.equal(position, cursor))) {
      return state;
    }

    const path = cursorApi.getPath(cursor);

    while (path.length > 0) {
      const entryId = path.at(-1);

      if (entryId !== undefined) {
        const parentPath = path.slice(0, -1);
        const parent = navNodeApi.getNodeAtPath(
          navigation.children,
          parentPath,
        );

        const foldEntry = parent?.entries.find(
          (entry) =>
            navNodeApi.entryIsFold(entry) &&
            entry.folded.some(
              (foldedEntry) =>
                !navNodeApi.entryIsFold(foldedEntry) &&
                foldedEntry.id === entryId,
            ),
        );

        if (foldEntry !== undefined && navNodeApi.entryIsFold(foldEntry)) {
          const firstEntry = foldEntry.folded.find(
            (entry) => !navNodeApi.entryIsFold(entry),
          );
          
          if (firstEntry !== undefined && !navNodeApi.entryIsFold(firstEntry)) {
            const foldCursor: Cursor<Id> = {
              parentPath,
              firstId: firstEntry.id,
            };

            if (
              positions.some((position) =>
                cursorApi.equal(position, foldCursor),
              )
            ) {
              return stateApi.update(state, { cursor: foldCursor }) ?? state;
            }
          }
        }

        const nodeCursor: Cursor<Id> = { path: [...path] };

        if (
          positions.some((position) => cursorApi.equal(position, nodeCursor))
        ) {
          return stateApi.update(state, { cursor: nodeCursor }) ?? state;
        }
      }

      path.pop();
    }

    // The root cursor is always included in `positions`.
    return stateApi.update(state, { cursor: { path: [] } }) ?? state;
  }

  function update(
    state: State<Id, Value>,
    changes: Parameters<StateApi<Id, Value>['update']>[1],
  ): State<Id, Value> {
    const nextState = stateApi.update(state, changes);

    return nextState === undefined ? state : reconcileCursor(nextState);
  }

  return (state, action) => {
    switch (action.kind) {
      case 'changeCursor':
        return update(state, { cursor: action.cursor });

      case 'updateBranch': {
        const root = treeNodeApi.updateAtPath(
          stateApi.getRoot(state),
          action.path,
          (node) => {
            /*
             * Loading/unloading is a branch-only operation. TreeMethods can
             * structurally convert any node, but the reducer must not turn a
             * leaf into a branch.
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

        return update(state, { root });
      }

      case 'setState': {
        // A newer update has already been applied.
        if (state !== action.oldState) {
          return state;
        }

        return reconcileCursor(action.newState);
      }

      case 'addToFoldTree': {
        const entryId = action.path.at(-1);

        if (entryId === undefined) {
          return state;
        }

        const parentPath = action.path.slice(0, -1);
        const folds = foldsApi.hideEntryAtPath(
          stateApi.getFolds(state),
          action.foldTreeIndex,
          parentPath,
          entryId,
        );

        if (folds === undefined) {
          return state;
        }

        return update(state, {
          folds,
          cursor: action.cursor,
        });
      }

      case 'removeFromFoldTree': {
        let folds = stateApi.getFolds(state);

        if (action.entryIds === null) {
          const nextFolds = foldsApi.showAllHiddenEntriesAtPath(
            folds,
            action.foldTreeIndex,
            action.path,
          );

          if (nextFolds === undefined) {
            return state;
          }

          folds = nextFolds;
        } else {
          for (const entryId of action.entryIds) {
            const nextFolds = foldsApi.showEntryAtPath(
              folds,
              action.foldTreeIndex,
              action.path,
              entryId,
            );

            if (nextFolds === undefined) {
              return state;
            }

            folds = nextFolds;
          }
        }

        return update(state, {
          folds,
          cursor: action.cursor,
        });
      }

      case 'fold': {
        const folds = foldsApi.activateAtIndex(
          stateApi.getFolds(state),
          action.foldTreeIndex,
        );

        return folds === undefined ? state : update(state, { folds });
      }

      case 'unfold': {
        const folds = foldsApi.deactivateAtIndex(
          stateApi.getFolds(state),
          action.foldTreeIndex,
        );

        return folds === undefined ? state : update(state, { folds });
      }

      case 'toggleFold': {
        const folds = foldsApi.toggleActiveAtIndex(
          stateApi.getFolds(state),
          action.foldTreeIndex,
        );

        return folds === undefined ? state : update(state, { folds });
      }

      case 'createFoldTree': {
        const currentFolds = stateApi.getFolds(state);
        const index = firstAvailableAdditionalFoldIndex(foldsApi, currentFolds);

        const folds = foldsApi.setAdditionalFoldAtIndex(
          currentFolds,
          index,
          // Obtain this through the actual TreeMethods root-ID operation.
          treeNodeApi.id(stateApi.getRoot(state)),
          {
            name: action.name,
            description: null,
          },
        );

        return folds === undefined ? state : update(state, { folds });
      }

      case 'deleteFoldTree': {
        const currentFolds = stateApi.getFolds(state);
        const index = foldsApi.getIndexByName(currentFolds, action.name);

        if (index === undefined || index === 0) {
          return state;
        }

        const folds = foldsApi.removeAdditionalFoldAtIndex(currentFolds, index);

        return folds === undefined ? state : update(state, { folds });
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
