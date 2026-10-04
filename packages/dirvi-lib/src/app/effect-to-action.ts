import type {
  CursorApi,
  FoldIndex,
  Folds,
  FoldsApi,
  NavBranch,
  NavNodeApi,
  SerializableKey,
  State,
} from '../trees/index.js';
import type { EffectAction, FoldTreeReference } from '../input/domain/index.js';
import type { ReducerAction } from './reducer-action.js';

export type EffectToAction<Id extends SerializableKey, Value> = (
  effectAction: EffectAction<Id, Value>,
  navigation: NavBranch<Id>,
  state: State<Id, Value>,
) => ReducerAction<Id, Value> | undefined;

function resolveFoldTreeIndex<Id extends SerializableKey>(
  foldsApi: FoldsApi<Id>,
  folds: Folds<Id>,
  foldTree: FoldTreeReference,
): FoldIndex | undefined {
  switch (foldTree.foldTreeReferenceType) {
    case 'index':
      return foldsApi.hasAtIndex(folds, foldTree.index)
        ? foldTree.index
        : undefined;

    case 'name':
      return foldsApi.getIndexByName(folds, foldTree.name);
  }
}

export function createEffectToAction<Id extends SerializableKey, Value>(
  foldsApi: FoldsApi<Id>,
  cursorApi: CursorApi<Id>,
  navNodeApi: NavNodeApi<Id, Value>,
): EffectToAction<Id, Value> {
  function effectToAction(
    effectAction: EffectAction<Id, Value>,
    navigation: NavBranch<Id>,
    state: State<Id, Value>,
  ): ReducerAction<Id, Value> | undefined {
    switch (effectAction.effectActionType) {
      case 'nextEntry': {
        const cursor = navNodeApi.nextCursor(navigation, state.cursor);

        return cursor === undefined
          ? undefined
          : {
              kind: 'changeCursor',
              cursor,
            };
      }

      case 'prevEntry': {
        const cursor = navNodeApi.previousCursor(navigation, state.cursor);

        return cursor === undefined
          ? undefined
          : {
              kind: 'changeCursor',
              cursor,
            };
      }

      case 'setBranchEntries':
        return {
          kind: 'updateBranch',
          path: effectAction.path,
          entries: effectAction.entries,
        };

      case 'navigateToParent': {
        const navNode = navigation.children;

        if (navNode === null) {
          return undefined;
        }

        const cursor = navNodeApi.parentCursor(navNode, state.cursor);

        return cursor === undefined
          ? undefined
          : {
              kind: 'changeCursor',
              cursor,
            };
      }

      case 'addToFoldTree': {
        if (state.cursor.length === 0) {
          return undefined;
        }

        const cursor = navNodeApi.cursorAfterFold(navigation, state.cursor);

        if (cursor === undefined) {
          return undefined;
        }

        const foldTreeIndex = resolveFoldTreeIndex(
          foldsApi,
          state.folds,
          effectAction.foldTree,
        );

        if (foldTreeIndex === undefined) {
          return undefined;
        }

        return {
          kind: 'addToFoldTree',
          path: state.cursor,
          cursor,
          foldTreeIndex,
        };
      }

      case 'removeFromFoldTree': {
        const currentPath = cursorApi.getPath(state.cursor);
        const navNode = navigation.children;

        if (navNode === null) {
          return undefined;
        }

        const node = navNodeApi.getNodeAtPath(navNode, currentPath);

        if (node === undefined || node.folded?.entries.length === 0) {
          return undefined;
        }

        const foldTreeIndex = resolveFoldTreeIndex(
          foldsApi,
          state.folds,
          effectAction.foldTree,
        );

        if (foldTreeIndex === undefined) {
          return undefined;
        }

        return {
          kind: 'removeFromFoldTree',
          path: currentPath,
          cursor: state.cursor,
          foldTreeIndex,
        };
      }

      case 'fold': {
        const foldTreeIndex = resolveFoldTreeIndex(
          foldsApi,
          state.folds,
          effectAction.foldTree,
        );

        return foldTreeIndex === undefined
          ? undefined
          : {
              kind: 'fold',
              foldTreeIndex,
            };
      }

      case 'unfold': {
        const foldTreeIndex = resolveFoldTreeIndex(
          foldsApi,
          state.folds,
          effectAction.foldTree,
        );

        return foldTreeIndex === undefined
          ? undefined
          : {
              kind: 'unfold',
              foldTreeIndex,
            };
      }
    }
  }

  return effectToAction;
}
