import type { ReducerAction } from './reducer-action.js';
import {
  SerializableKey,
  TreeNode,
  TreeNodeApi,
} from 'dirvi-lib/dist/tree-surfer/tree-node/tree-node.types.js';
import { CursorApi, EffectAction, NavNode, NavNodeApi, State } from 'dirvi-lib';

export type EffectToAction<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
> = (
  effectAction: EffectAction<Id, BufferNode>,
  navigation: NavNode<Id, BufferNode>,
  state: State<Id, BufferNode>,
) => ReducerAction<Id, BufferNode> | undefined;

export function createEffectToAction<
  Id extends SerializableKey,
  BufferNode extends TreeNode<Id, BufferNode>,
>(
  treeNodeApi: TreeNodeApi<Id, BufferNode>,
  cursorApi: CursorApi<Id>,
  navNodeApi: NavNodeApi<Id, BufferNode>,
): EffectToAction<Id, BufferNode> {
  function effectToAction(
    effectAction: EffectAction<Id, BufferNode>,
    navigation: NavNode<Id, BufferNode>,
    state: State<Id, BufferNode>,
  ): ReducerAction<Id, BufferNode> | undefined {
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
        const cursor = navNodeApi.parentCursor(navigation, state.cursor);

        return cursor === undefined
          ? undefined
          : {
              kind: 'changeCursor',
              cursor,
            };
      }

      case 'fold': {
        if (state.cursor.kind === 'fold') {
          return undefined;
        }

        const path = [...state.cursor.parentPath, state.cursor.entryId];

        const entry = treeNodeApi.getAtPath(state.buffer, path, (node) => node);

        if (entry === undefined) {
          return undefined;
        }

        const cursor = navNodeApi.cursorAfterFold(navigation, state.cursor);
        if (cursor === undefined) {
          return undefined;
        }

        return {
          kind: 'fold',
          parentPath: [...state.cursor.parentPath],
          entry,
          cursor,
        };
      }

      case 'unfold': {
        if (state.cursor.kind !== 'fold') {
          return undefined;
        }

        const node = navNodeApi.getNodeAtPath(navigation, [
          ...state.cursor.parentPath,
        ]);

        if (node === undefined || node.foldedEntries.length === 0) {
          return undefined;
        }

        const firstFoldedEntry = node.foldedEntries[0];

        return {
          kind: 'unfold',
          parentPath: [...state.cursor.parentPath],
          cursor: {
            kind: 'entry',
            parentPath: state.cursor.parentPath,
            entryId: firstFoldedEntry.id,
          },
        };
      }

      case 'toggleFold':
        return effectToAction(
          state.cursor.kind === 'fold'
            ? { effectActionType: 'unfold' }
            : { effectActionType: 'fold' },
          navigation,
          state,
        );
    }
  }

  return effectToAction;
}
