import {
  State,
  EffectAction,
  PosixNavNode,
  PosixState,
  PosixNavApi,
  PosixNodeApi,
  PosixNode,
  PosixName,
  type TreeNode,
  NavNode,
  TreeNodeApi,
  NavNodeApi,
} from 'dirvi-lib';

import type { ReducerAction } from './reducer-action.js';

export type EffectToAction<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
> = (
  effectAction: EffectAction<Name, BufferNode>,
  navigation: NavNode<Name, BufferNode>,
  state: State<Name, BufferNode>,
) => ReducerAction<Name, BufferNode> | undefined;

export function createEffectToAction<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
>(
  navNodeApi: NavNodeApi<Name, BufferNode>,
  treeNodeApi: TreeNodeApi<Name, BufferNode>,
): EffectToAction<Name, BufferNode> {
  function effectToAction(
    effectAction: EffectAction<Name, BufferNode>,
    navigation: NavNode<Name, BufferNode>,
    state: State<Name, BufferNode>,
  ): ReducerAction<Name, BufferNode> | undefined {
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

        const path = [...state.cursor.parentPath, state.cursor.entryName];

        const entry = treeNodeApi.getAtPath(state.buffer, path);

        if (entry === undefined) {
          return undefined;
        }

        const cursor = navNodeApi.cursorAfterFold(navigation, state.cursor);
        if (cursor === undefined) {
          return undefined;
        }

        return {
          kind: 'fold',
          parentPath: state.cursor.parentPath,
          entry,
          cursor,
        };
      }

      case 'unfold': {
        if (state.cursor.kind !== 'fold') {
          return undefined;
        }

        const node = navNodeApi.getNodeAtPath(
          navigation,
          state.cursor.parentPath,
        );

        if (node === undefined || node.foldedEntries.length === 0) {
          return undefined;
        }

        const firstFoldedEntry = node.foldedEntries[0];

        return {
          kind: 'unfold',
          parentPath: state.cursor.parentPath,
          cursor: {
            kind: 'entry',
            parentPath: state.cursor.parentPath,
            entryName: firstFoldedEntry.name,
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
