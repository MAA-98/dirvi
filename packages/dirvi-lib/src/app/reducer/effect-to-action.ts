import type {
  CursorApi,
  FoldIndex,
  Folds,
  FoldsApi,
  NavBranch,
  NavNodeApi,
  SerializableKey,
  State,
} from '../../trees/index.js';
import type { EffectAction, FoldTreeReference } from '../../input/domain/index.js';
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
  foldsApi: FoldsApi<Id>,
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

    case 'name':
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

    default: {
      const _exhaustive: never = foldTree;

      throw new Error(
        `Unhandled fold tree reference: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
}

export function createEffectToAction<Id extends SerializableKey, Value>(
  foldsApi: FoldsApi<Id>,
  cursorApi: CursorApi<Id>,
  navNodeApi: NavNodeApi<Id, Value>,
): EffectToAction<Id, Value> {
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
    switch (effectAction.effectActionType) {
      case 'nextEntry': {
        const cursor = navNodeApi.nextCursor(navigation, state.cursor);

        return cursor === undefined
          ? ignored()
          : action({
              kind: 'changeCursor',
              cursor,
            });
      }

      case 'prevEntry': {
        const cursor = navNodeApi.previousCursor(navigation, state.cursor);

        return cursor === undefined
          ? ignored()
          : action({
              kind: 'changeCursor',
              cursor,
            });
      }

      case 'setBranchEntries':
        return action({
          kind: 'updateBranch',
          path: effectAction.path,
          entries: effectAction.entries,
        });

      case 'navigateToParent': {
        // TODO: navigation should be Loaded Branch instead to encode invariant
        // in state
        const navNode = navigation.children;

        if (navNode === null) {
          return ignored();
        }

        const cursor = navNodeApi.parentCursor(navNode, state.cursor);

        return cursor === undefined
          ? ignored()
          : action({
              kind: 'changeCursor',
              cursor,
            });
      }

      case 'addToFoldTree': {
        const foldTree = resolveFoldTreeIndex(
          foldsApi,
          state.folds,
          effectAction.foldTree,
        );

        if (foldTree.kind === 'notFound') {
          return rejected(foldTree.message);
        }

        if (state.cursor.length === 0) {
          return ignored();
        }

        const cursor = navNodeApi.cursorAfterFold(navigation, state.cursor);

        if (cursor === undefined) {
          return ignored();
        }

        return action({
          kind: 'addToFoldTree',
          path: state.cursor,
          cursor,
          foldTreeIndex: foldTree.index,
        });
      }

      case 'removeFromFoldTree': {
        const foldTree = resolveFoldTreeIndex(
          foldsApi,
          state.folds,
          effectAction.foldTree,
        );

        if (foldTree.kind === 'notFound') {
          return rejected(foldTree.message);
        }

        const currentPath = cursorApi.getPath(state.cursor);
        const navNode = navigation.children;

        // TODO: Should not be possible with update type
        if (navNode === null) {
          return ignored();
        }

        const node = navNodeApi.getNodeAtPath(navNode, currentPath);

        if (node === undefined || node.folded?.entries.length === 0) {
          return ignored();
        }

        return action({
          kind: 'removeFromFoldTree',
          path: currentPath,
          cursor: state.cursor,
          foldTreeIndex: foldTree.index,
        });
      }

      case 'fold': {
        const foldTree = resolveFoldTreeIndex(
          foldsApi,
          state.folds,
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
          state.folds,
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
          state.folds,
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
        const existingIndex = foldsApi.getIndexByName(
          state.folds,
          effectAction.name,
        );

        return existingIndex === undefined
          ? action({
              kind: 'createFoldTree',
              name: effectAction.name,
            })
          : rejected(`Fold tree named "${effectAction.name}" already exists.`);
      }

      case 'deleteFoldTree': {
        const foldTreeIndex = foldsApi.getIndexByName(
          state.folds,
          effectAction.name,
        );

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

      default:
        const _exhaustive: never = effectAction;

        throw new Error(
          `Unhandled effect action: ${JSON.stringify(_exhaustive)}`,
        );
    }
  }

  return effectToAction;
}
