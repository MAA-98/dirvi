import { FoldNodeApi, State, TreeNode, TreeNodeApi } from 'dirvi-lib';
import { ReducerAction } from './reducer-action.js';

export type Reducer<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
> = (
  state: State<Name, BufferNode>,
  action: ReducerAction<Name, BufferNode>,
) => State<Name, BufferNode>;

export function createReducer<
  Name extends PropertyKey,
  BufferNode extends TreeNode<Name, BufferNode>,
>(
  treeNodeApi: TreeNodeApi<Name, BufferNode>,
  foldNodeApi: FoldNodeApi<Name, BufferNode>,
): Reducer<Name, BufferNode> {
  return (state, action) => {
    switch (action.kind) {
      case 'changeCursor':
        return {
          ...state,
          cursor: action.cursor,
        };

      case 'updateBranch':
        const buffer = treeNodeApi.setBranchesAtPath(
          state.buffer,
          action.path,
          action.entries,
        );

        if (buffer === undefined) {
          return state;
        }

        return {
          ...state,
          buffer,
        };

      case 'updateBuffer':
        // A newer update has already been applied.
        if (state.buffer !== action.oldEntries) {
          return state;
        }

        return {
          ...state,
          buffer: action.entries,
        };

      case 'fold': {
        const foldNode = foldNodeApi.addFoldedEntryAtPath(
          state.foldNode,
          action.parentPath,
          action.entry,
        );

        return {
          ...state,
          foldNode,
          cursor: action.cursor,
        };
      }

      case 'unfold': {
        const foldNode = foldNodeApi.modifyAtPath(
          state.foldNode,
          action.parentPath,
          (node) => foldNodeApi.clearFoldedEntries(node),
        );

        return {
          ...state,
          foldNode,
          cursor: action.cursor,
        };
      }
    }
  };
}
