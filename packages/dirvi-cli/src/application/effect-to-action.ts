import type { ReducerAction } from './reducer-action.js';
import {
  SerializableKey,
  TreeNode,
  TreeNodeApi,
} from 'dirvi-lib/dist/tree-surfer/tree-node/tree-node.types.js';
import { CursorApi, EffectAction, NavBranch, NavNode, NavNodeApi, State } from 'dirvi-lib';

export type EffectToAction<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
> = (
  effectAction: EffectAction<Id, Node>,
  navigation: NavBranch<Id>,
  state: State<Id, Node>,
) => ReducerAction<Id, Node> | undefined;

export function createEffectToAction<
  Id extends SerializableKey,
  Node extends TreeNode<Id, Node>,
>(
  treeNodeApi: TreeNodeApi<Id, Node>,
  cursorApi: CursorApi<Id>,
  navNodeApi: NavNodeApi<Id, Node>,
): EffectToAction<Id, Node> {
  function effectToAction(
    effectAction: EffectAction<Id, Node>,
    navigation: NavBranch<Id>,
    state: State<Id, Node>,
  ): ReducerAction<Id, Node> | undefined {
    
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
          return undefined
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
