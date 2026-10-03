import type {
  CursorApi,
  NavBranch,
  NavNodeApi,
  SerializableKey,
  State,
} from '../trees/index.js';
import type { EffectAction } from '../input/domain/index.js';
import type { ReducerAction } from './reducer-action.js';

export type EffectToAction<Id extends SerializableKey, Value> = (
  effectAction: EffectAction<Id, Value>,
  navigation: NavBranch<Id>,
  state: State<Id, Value>,
) => ReducerAction<Id, Value> | undefined;

export function createEffectToAction<Id extends SerializableKey, Value>(
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

      case 'fold': {
        if (state.cursor.length === 0) {
          return undefined;
        }

        const cursor = navNodeApi.cursorAfterFold(navigation, state.cursor);

        if (cursor === undefined) {
          return undefined;
        }

        return {
          kind: 'fold',
          path: state.cursor,
          cursor,
        };
      }

      case 'unfold': {
        const currentPath = cursorApi.getPath(state.cursor);
        const navNode = navigation.children;

        if (navNode === null) {
          return undefined;
        }

        const node = navNodeApi.getNodeAtPath(navNode, currentPath);

        if (node === undefined || node.folded?.entries.length === 0) {
          return undefined;
        }

        return {
          kind: 'unfold',
          path: currentPath,
          cursor: state.cursor,
        };
      }
    }
  }

  return effectToAction;
}
