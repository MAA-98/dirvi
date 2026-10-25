import type {
  FoldIndex,
  FoldMethods,
  Folds,
  NavBranch,
  NavMethods,
  SerializableKey,
  State,
  StateApi,
} from '../../state-and-nav/index.js';
import type {
  EffectAction,
  FoldTreeReference,
} from '../../input/domain/index.js';
import type { ReducerAction } from './reducer-action.js';

export type EffectToActionResult<Id extends SerializableKey, Value> =
  | Readonly<{
      kind: 'action';
      action: ReducerAction<Id, Value>;
    }>
  | Readonly<{
      kind: 'rejected';
      message: string;
    }>
  | Readonly<{
      kind: 'ignored';
    }>;

export type EffectToAction<Id extends SerializableKey, Value> = (
  effectAction: EffectAction<Id, Value>,
  navigation: NavBranch<Id>,
  state: State<Id, Value>,
) => EffectToActionResult<Id, Value>;

type FoldTreeResolution =
  | Readonly<{
      kind: 'found';
      index: FoldIndex;
    }>
  | Readonly<{
      kind: 'notFound';
      message: string;
    }>;

function resolveFoldTreeIndex<Id extends SerializableKey>(
  foldsApi: FoldMethods<Id>,
  folds: Folds<Id>,
  foldTree: FoldTreeReference,
): FoldTreeResolution {
  switch (foldTree.foldTreeReferenceType) {
    case 'index':
      return foldsApi.hasAtIndex(folds, foldTree.index)
        ? {
            kind: 'found',
            index: foldTree.index,
          }
        : {
            kind: 'notFound',
            message: `Fold tree at index ${foldTree.index} not found.`,
          };

    case 'name': {
      const index = foldsApi.getIndexByName(folds, foldTree.name);

      return index === undefined
        ? {
            kind: 'notFound',
            message: `Fold tree named "${foldTree.name}" not found.`,
          }
        : {
            kind: 'found',
            index,
          };
    }

    default: {
      const _exhaustive: never = foldTree;

      throw new Error(
        `Unhandled fold tree reference: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
}

export function createEffectToAction<Id extends SerializableKey, Value>(
  stateApi: StateApi<Id, Value>,
  navNodeApi: NavMethods<Id, Value>,
): EffectToAction<Id, Value> {
  const { cursorApi, foldsApi } = stateApi;

  function action(
    reducerAction: ReducerAction<Id, Value>,
  ): EffectToActionResult<Id, Value> {
    return {
      kind: 'action',
      action: reducerAction,
    };
  }

  function rejected(message: string): EffectToActionResult<Id, Value> {
    return {
      kind: 'rejected',
      message,
    };
  }

  function ignored(): EffectToActionResult<Id, Value> {
    return {
      kind: 'ignored',
    };
  }

  function effectToAction(
    effectAction: EffectAction<Id, Value>,
    navigation: NavBranch<Id>,
    state: State<Id, Value>,
  ): EffectToActionResult<Id, Value> {
    const cursor = stateApi.getCursor(state);
    const folds = stateApi.getFolds(state);

    switch (effectAction.effectActionType) {
      case 'nextEntry': {
        const nextCursor = navNodeApi.nextCursor(navigation, cursor);

        return nextCursor === undefined
          ? ignored()
          : action({
              kind: 'changeCursor',
              cursor: nextCursor,
            });
      }

      case 'prevEntry': {
        const previousCursor = navNodeApi.previousCursor(navigation, cursor);

        return previousCursor === undefined
          ? ignored()
          : action({
              kind: 'changeCursor',
              cursor: previousCursor,
            });
      }

      case 'setBranchEntries':
        return action({
          kind: 'updateBranch',
          path: effectAction.path,
          entries: effectAction.entries,
        });

      case 'navigateToParent': {
        // TODO: Encode the loaded-root invariant in the navigation type.
        const navNode = navigation.children;

        if (navNode === null) {
          return ignored();
        }

        const parentCursor = navNodeApi.parentCursor(navNode, cursor);

        return parentCursor === undefined
          ? ignored()
          : action({
              kind: 'changeCursor',
              cursor: parentCursor,
            });
      }

      case 'addToFoldTree': {
        const foldTree = resolveFoldTreeIndex(
          foldsApi,
          folds,
          effectAction.foldTree,
        );

        if (foldTree.kind === 'notFound') {
          return rejected(foldTree.message);
        }

        // The root cannot be folded, and a fold marker is already folded.
        if (!cursorApi.isNodeCursor(cursor) || cursor.path.length === 0) {
          return ignored();
        }

        /*
         * Adding an entry to an inactive fold tree does not change the
         * navigation projection, so keep the cursor where it is.
         */
        const nextCursor =
          foldsApi.isActiveAtIndex(folds, foldTree.index) === true
            ? navNodeApi.cursorAfterFold(navigation, cursor)
            : cursor;

        if (nextCursor === undefined) {
          return ignored();
        }

        return action({
          kind: 'addToFoldTree',
          path: cursor.path,
          cursor: nextCursor,
          foldTreeIndex: foldTree.index,
        });
      }

      case 'removeFromFoldTree': {
        const foldTree = resolveFoldTreeIndex(
          foldsApi,
          folds,
          effectAction.foldTree,
        );

        if (foldTree.kind === 'notFound') {
          return rejected(foldTree.message);
        }

        const navNode = navigation.children;

        // TODO: Encode the loaded-root invariant in the navigation type.
        if (navNode === null) {
          return ignored();
        }

        if (cursorApi.isFoldCursor(cursor)) {
          const parent = navNodeApi.getNodeAtPath(navNode, cursor.parentPath);

          const foldEntry = parent?.entries.find((entry) => {
            if (!navNodeApi.entryIsFold(entry)) {
              return false;
            }

            const firstEntry = entry.folded[0];

            return (
              firstEntry !== undefined &&
              !navNodeApi.entryIsFold(firstEntry) &&
              firstEntry.id === cursor.firstId
            );
          });

          if (foldEntry === undefined || !navNodeApi.entryIsFold(foldEntry)) {
            return ignored();
          }

          /*
           * Remove only this fold tree's contribution to the selected
           * ordered run. Other fold trees may still hide some entries.
           */
          const entryIds: Id[] = [];

          for (const entry of foldEntry.folded) {
            if (
              !navNodeApi.entryIsFold(entry) &&
              foldsApi.isEntryHiddenInFoldAtPath(
                folds,
                foldTree.index,
                cursor.parentPath,
                entry.id,
              )
            ) {
              entryIds.push(entry.id);
            }
          }

          const firstId = entryIds[0];

          if (firstId === undefined) {
            return ignored();
          }

          return action({
            kind: 'removeFromFoldTree',
            path: cursor.parentPath,
            entryIds,
            cursor: {
              path: [...cursor.parentPath, firstId],
            },
            foldTreeIndex: foldTree.index,
          });
        }

        /*
         * In unordered navigation, folds are summarized on the selected
         * parent. Reveal all direct entries hidden by this fold tree there.
         */
        const node = navNodeApi.getNodeAtPath(navNode, cursor.path);
        const hasFoldedEntries = node?.entries.some(
          (entry) => navNodeApi.entryIsFold(entry) && entry.folded.length > 0,
        );

        if (!hasFoldedEntries) {
          return ignored();
        }

        return action({
          kind: 'removeFromFoldTree',
          path: cursor.path,
          entryIds: null,
          cursor,
          foldTreeIndex: foldTree.index,
        });
      }

      case 'fold': {
        const foldTree = resolveFoldTreeIndex(
          foldsApi,
          folds,
          effectAction.foldTree,
        );

        return foldTree.kind === 'notFound'
          ? rejected(foldTree.message)
          : action({
              kind: 'fold',
              foldTreeIndex: foldTree.index,
            });
      }

      case 'unfold': {
        const foldTree = resolveFoldTreeIndex(
          foldsApi,
          folds,
          effectAction.foldTree,
        );

        return foldTree.kind === 'notFound'
          ? rejected(foldTree.message)
          : action({
              kind: 'unfold',
              foldTreeIndex: foldTree.index,
            });
      }

      case 'toggleFold': {
        const foldTree = resolveFoldTreeIndex(
          foldsApi,
          folds,
          effectAction.foldTree,
        );

        return foldTree.kind === 'notFound'
          ? rejected(foldTree.message)
          : action({
              kind: 'toggleFold',
              foldTreeIndex: foldTree.index,
            });
      }

      case 'createFoldTree': {
        const existingIndex = foldsApi.getIndexByName(folds, effectAction.name);

        return existingIndex === undefined
          ? action({
              kind: 'createFoldTree',
              name: effectAction.name,
            })
          : rejected(`Fold tree named "${effectAction.name}" already exists.`);
      }

      case 'deleteFoldTree': {
        const foldTreeIndex = foldsApi.getIndexByName(folds, effectAction.name);

        if (foldTreeIndex === undefined) {
          return rejected(`Fold tree named "${effectAction.name}" not found.`);
        }

        if (foldTreeIndex === 0) {
          return rejected(
            'The primary fold tree at index 0 cannot be deleted.',
          );
        }

        return action({
          kind: 'deleteFoldTree',
          name: effectAction.name,
        });
      }

      default: {
        const _exhaustive: never = effectAction;

        throw new Error(
          `Unhandled effect action: ${JSON.stringify(_exhaustive)}`,
        );
      }
    }
  }

  return effectToAction;
}
